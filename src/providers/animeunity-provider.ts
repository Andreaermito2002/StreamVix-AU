import { spawn } from 'child_process';
import { KitsuProvider } from './kitsu';
import { formatMediaFlowUrl } from '../utils/mediaflow';
import { AnimeUnityConfig, StreamForStremio } from '../types/animeunity';
import * as path from 'path';

// Helper function to invoke the Python scraper
async function invokePythonScraper(args: string[]): Promise<any> {
    const scriptPath = path.join(__dirname, 'animeunity_scraper.py');
    
    // Use python3, ensure it's in the system's PATH
    const command = 'python3';

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn(command, [scriptPath, ...args]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code: number) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}`);
                console.error(stderr);
                return reject(new Error(`Python script error: ${stderr}`));
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (e) {
                console.error('Failed to parse Python script output:');
                console.error(stdout);
                reject(new Error('Failed to parse Python script output.'));
            }
        });

        pythonProcess.on('error', (err: Error) => {
            console.error('Failed to start Python script:', err);
            reject(err);
        });
    });
}

interface AnimeUnitySearchResult {
    id: number;
    slug: string;
    name: string;
    episodes_count: number;
}

interface AnimeUnityEpisode {
    id: number;
    number: string;
    name?: string;
}

interface AnimeUnityStreamData {
    episode_page: string;
    embed_url: string;
    mp4_url: string;
}

export class AnimeUnityProvider {
  private kitsuProvider = new KitsuProvider();

  constructor(private config: AnimeUnityConfig) {}

  private async searchAllVersions(title: string): Promise<{ version: AnimeUnitySearchResult; language_type: string }[]> {
      const subPromise = invokePythonScraper(['search', '--query', title]).catch(() => []);
      const dubPromise = invokePythonScraper(['search', '--query', title, '--dubbed']).catch(() => []);

      const [subResults, dubResults]: [AnimeUnitySearchResult[], AnimeUnitySearchResult[]] = await Promise.all([subPromise, dubPromise]);
      const results: { version: AnimeUnitySearchResult; language_type: string }[] = [];

      // Unisci tutti i risultati (SUB e DUB), ma assegna ITA se il nome contiene ITA
      const allResults = [...subResults, ...dubResults];
      for (const r of allResults) {
        const nameLower = r.name.toLowerCase();
        const language_type = nameLower.includes('ita') ? 'ITA' : 'SUB';
        results.push({ version: r, language_type });
      }
      return results;
  }

  async handleKitsuRequest(kitsuIdString: string): Promise<{ streams: StreamForStremio[] }> {
    if (!this.config.enabled) {
      return { streams: [] };
    }

    try {
      const { kitsuId, seasonNumber, episodeNumber, isMovie } = this.kitsuProvider.parseKitsuId(kitsuIdString);
      
      const animeInfo = await this.kitsuProvider.getAnimeInfo(kitsuId);
      if (!animeInfo) {
        return { streams: [] };
      }
      
      const normalizedTitle = this.kitsuProvider.normalizeTitle(animeInfo.title);
      const animeVersions = await this.searchAllVersions(normalizedTitle);
      
      if (!animeVersions.length) {
        return { streams: [] };
      }
      
      if (isMovie) {
        // Assuming movies are treated as episode 1
        const episodeToFind = "1";
        const streams: StreamForStremio[] = [];

        for (const { version, language_type } of animeVersions) {
            const episodes: AnimeUnityEpisode[] = await invokePythonScraper(['get_episodes', '--anime-id', String(version.id)]);
            const targetEpisode = episodes.find(ep => ep.number === episodeToFind);

            if (targetEpisode) {
                const streamResult: AnimeUnityStreamData = await invokePythonScraper([
                    'get_stream',
                    '--anime-id', String(version.id),
                    '--anime-slug', version.slug,
                    '--episode-id', String(targetEpisode.id)
                ]);

                if (streamResult.mp4_url) {
                    streams.push({
                        title: `🎬 AnimeUnity ${language_type} (Movie)`,
                        url: streamResult.mp4_url,
                        behaviorHints: { notWebReady: true }
                    });
                }
            }
        }
        return { streams };
      }
      
      const streams: StreamForStremio[] = [];
      
      for (const { version, language_type } of animeVersions) {
        try {
          const episodes: AnimeUnityEpisode[] = await invokePythonScraper(['get_episodes', '--anime-id', String(version.id)]);
          const targetEpisode = episodes.find(ep => String(ep.number) === String(episodeNumber));
          
          if (!targetEpisode) continue;
          
          const streamResult: AnimeUnityStreamData = await invokePythonScraper([
            'get_stream',
            '--anime-id', String(version.id),
            '--anime-slug', version.slug,
            '--episode-id', String(targetEpisode.id)
          ]);
          
          if (streamResult.mp4_url) {
            const mediaFlowUrl = formatMediaFlowUrl(
              streamResult.mp4_url,
              this.config.mfpUrl,
              this.config.mfpPassword
            );

            // Rimuovi eventuali (ITA) dal nome
            const cleanName = version.name.replace(/\s*\(ITA\)/i, '').trim();
            const isDub = language_type === 'DUB';
            const mainName = isDub ? `${cleanName} ITA` : cleanName;
            const sNum = seasonNumber || 1;
            let streamTitle = isDub
              ? `${capitalize(cleanName)} ITA S${sNum}`
              : `${capitalize(cleanName)} SUB S${sNum}`;
            if (episodeNumber) {
              streamTitle += `E${episodeNumber}`;
            }

            streams.push({
              title: streamTitle,
              url: mediaFlowUrl,
              behaviorHints: {
                notWebReady: true
              }
            });

            if (this.config.bothLink && streamResult.embed_url) {
              streams.push({
                title: `[E] ${streamTitle}`,
                url: streamResult.embed_url,
                behaviorHints: {
                  notWebReady: true
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error processing version ${language_type}:`, error);
        }
      }
      
      return { streams };
    } catch (error) {
      console.error('Error handling Kitsu request:', error);
      return { streams: [] };
    }
  }
}

// Funzione di utilità per capitalizzare la prima lettera
function capitalize(str: string) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
