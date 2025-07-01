// Per evitare errori di linter su __dirname, child_process e path, assicurati di avere installato i tipi Node:
// npm install --save-dev @types/node
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { spawn } from 'child_process';
import { KitsuProvider } from './kitsu';
import { formatMediaFlowUrl } from '../utils/mediaflow';
import { AnimeUnityConfig, StreamForStremio } from '../types/animeunity';
import * as path from 'path';
// @ts-ignore
import { Buffer } from 'buffer';

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

// Funzione di utilità per filtrare le versioni principali (SUB e ITA)
function filterMainVersions(results: AnimeUnitySearchResult[], baseTitle: string): { version: AnimeUnitySearchResult, language_type: string }[] {
    const normalizedBase = baseTitle.trim().toLowerCase();
    const itaTitle = `${normalizedBase} (ita)`;

    // Filtra per nome esatto (SUB e ITA)
    const filtered = results.filter(r => {
        const name = r.name.trim().toLowerCase();
        return name === normalizedBase || name === itaTitle;
    });

    // Se troviamo le versioni principali, restituiamo solo quelle
    if (filtered.length > 0) {
        return filtered.map(r => ({
            version: r,
            language_type: r.name.toLowerCase().includes('ita') ? 'ITA' : 'SUB'
        }));
    }

    // Altrimenti, fallback: primi due risultati (SUB e ITA)
    return results.slice(0, 2).map((r, idx) => ({
        version: r,
        language_type: idx === 1 ? 'ITA' : 'SUB'
    }));
}

export class AnimeUnityProvider {
  private kitsuProvider = new KitsuProvider();

  constructor(private config: AnimeUnityConfig) {}

  /**
   * Gestisce la richiesta di stream da Kitsu, cercando solo le versioni principali (SUB e ITA).
   * Filtra i risultati per nome esatto (nomeSerie e nomeSerie (ITA)),
   * oppure prende i primi due risultati come fallback.
   * Non aggiunge più i link Embed [E].
   */
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
      // Esegui la ricerca solo una volta (senza --dubbed)
      const allResults: AnimeUnitySearchResult[] = await invokePythonScraper(['search', '--query', normalizedTitle]);
      // Filtra le versioni principali (SUB e ITA)
      const animeVersions = filterMainVersions(allResults, normalizedTitle);
      
      if (!animeVersions.length) {
        return { streams: [] };
      }
      
      if (isMovie) {
        // I film sono trattati come episodio 1
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
            const isDub = language_type === 'ITA';
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
