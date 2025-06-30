import { addonBuilder, getRouter, Manifest, Stream } from "stremio-addon-sdk";
import { getStreamContent, VixCloudStreamInfo, ExtractorConfig } from "./extractor";
import * as fs from 'fs';
import { landingTemplate } from './landingPage';
import * as path from 'path';
import express, { Request, Response, NextFunction } from 'express'; // ✅ CORRETTO: Import tipizzato
import { AnimeUnityProvider } from './providers/animeunity-provider';
import { KitsuProvider } from './providers/kitsu'; 
import { formatMediaFlowUrl } from './utils/mediaflow';
import { AnimeUnityConfig } from "./types/animeunity";

// Interfaccia per la configurazione URL
interface AddonConfig {
  mediaFlowProxyUrl?: string;
  mediaFlowProxyPassword?: string;
  tmdbApiKey?: string;
  bothLinks?: string;
  animeunityEnabled?: string;
  [key: string]: any;
}

// Base manifest configuration
const baseManifest: Manifest = {
    id: "org.stremio.vixcloud",
    version: "2.0.1",
    name: "StreamViX",
    description: "Addon for Vixsrc and AnimeUnity streams", 
    icon: "/public/icon.png",
    background: "/public/backround.png",
    types: ["movie", "series"],
    idPrefixes: ["tt", "kitsu"],
    catalogs: [],
    resources: ["stream"],
    behaviorHints: {
        configurable: true
    },
    config: [
        {
            key: "tmdbApiKey",
            title: "TMDB API Key",
            type: "password"
        },
        {
            key: "mediaFlowProxyUrl", 
            title: "MediaFlow Proxy URL",
            type: "text"
        },
        {
            key: "mediaFlowProxyPassword",
            title: "MediaFlow Proxy Password ", 
            type: "password"
        },
        {
            key: "bothLinks",
            title: "Mostra entrambi i link (Proxy e Direct)",
            type: "checkbox"
        },
        {
            key: "animeunityEnabled",
            title: "Enable AnimeUnity (Kitsu Catalog)",
            type: "checkbox"
        }
    ]
};

// Load custom configuration if available
function loadCustomConfig(): Manifest {
    try {
        const configPath = path.join(__dirname, '..', 'addon-config.json');
        
        if (fs.existsSync(configPath)) {
            const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            return {
                ...baseManifest,
                id: customConfig.addonId || baseManifest.id,
                name: customConfig.addonName || baseManifest.name,
                description: customConfig.addonDescription || baseManifest.description,
                version: customConfig.addonVersion || baseManifest.version,
                logo: customConfig.addonLogo || baseManifest.logo,
                icon: customConfig.addonLogo || baseManifest.icon,
                background: baseManifest.background
            };
        }
    } catch (error) {
        console.error('Error loading custom configuration:', error);
    }
    
    return baseManifest;
}

// Funzione per creare il server Express
function createExpressApp(config: AddonConfig) {
    const app = express();

    app.get('/stream/animeunity/:url', (req, res) => {
        try {
            const encodedUrl = req.params.url;
            const decodedUrl = decodeURIComponent(encodedUrl);
            console.log(`Redirecting to AnimeUnity stream: ${decodedUrl}`);
            res.redirect(decodedUrl);
        } catch (error) {
            console.error('Error handling AnimeUnity stream redirect:', error);
            res.status(500).send('Error redirecting to stream.');
        }
    });

    const router = getRouter({ ...baseManifest, config });
    app.use(router);

    return app;
}

// Funzione per parsare la configurazione dall'URL
function parseConfigFromArgs(args: any): AddonConfig {
    const config: AddonConfig = {};
    
    if (typeof args === 'string') {
        try {
            const decoded = decodeURIComponent(args);
            const parsed = JSON.parse(decoded);
            return parsed;
        } catch (error) {
            return {};
        }
    }
    
    if (typeof args === 'object' && args !== null) {
        return args;
    }
    
    return config;
}

// Funzione per creare il builder con configurazione dinamica
function createBuilder(config: AddonConfig = {}) {
    const manifest = loadCustomConfig();
    
    if (config.mediaFlowProxyUrl || config.bothLinks || config.tmdbApiKey) {
        manifest.name;
    }
    
    const builder = new addonBuilder(manifest);

    builder.defineStreamHandler(
        async ({
            id,
            type,
        }: {  // ✅ CORRETTO: Annotazioni di tipo esplicite
            id: string;
            type: string;
        }): Promise<{
            streams: Stream[];
        }> => {
            try {
                console.log(`🔍 Stream request: ${type}/${id}`);
                
                const allStreams: Stream[] = [];
                
                // Gestione AnimeUnity per ID Kitsu con fallback variabile ambiente
                const animeUnityEnabled = (config.animeunityEnabled === 'on') || 
                                        (process.env.ANIMEUNITY_ENABLED?.toLowerCase() === 'true');
                
                if (animeUnityEnabled && id.startsWith('kitsu:')) {
                    console.log(`🎌 Processing Kitsu ID: ${id}`);
                    try {
                        const bothLinkValue = config.bothLinks === 'on';
                        
                        const animeUnityConfig: AnimeUnityConfig = {
                            enabled: true,
                            mfpUrl: config.mediaFlowProxyUrl || process.env.MFP_URL || '',
                            mfpPassword: config.mediaFlowProxyPassword || process.env.MFP_PSW || '',
                            bothLink: bothLinkValue
                        };
                        
                        const animeUnityProvider = new AnimeUnityProvider(animeUnityConfig);
                        const animeUnityResult = await animeUnityProvider.handleKitsuRequest(id);
                        console.log(`🎌 AnimeUnity streams found: ${animeUnityResult.streams.length}`);
                        allStreams.push(...animeUnityResult.streams);
                    } catch (error) {
                        console.error('🚨 AnimeUnity error:', error);
                    }
                }
                
                // Mantieni logica VixSrc per tutti gli altri ID
                if (!id.startsWith('kitsu:')) {
                    console.log(`📺 Processing non-Kitsu ID with VixSrc: ${id}`);
                    
                    let bothLinkValue: boolean;
                    if (config.bothLinks !== undefined) {
                        bothLinkValue = config.bothLinks === 'on';
                    } else {
                        bothLinkValue = process.env.BOTHLINK?.toLowerCase() === 'true';
                    }

                    const finalConfig: ExtractorConfig = {
                        tmdbApiKey: config.tmdbApiKey || process.env.TMDB_API_KEY,
                        mfpUrl: config.mediaFlowProxyUrl || process.env.MFP_URL,
                        mfpPsw: config.mediaFlowProxyPassword || process.env.MFP_PSW,
                        bothLink: bothLinkValue
                    };

                    const res: VixCloudStreamInfo[] | null = await getStreamContent(id, type, finalConfig);

                    if (res) {
                        for (const st of res) {
                            if (st.streamUrl == null) continue;
                            
                            console.log(`Adding stream with title: "${st.name}"`);

                            const streamName = st.source === 'proxy' ? 'StreamViX (Proxy)' : 'StreamViX';
                            
                            allStreams.push({
                                title: st.name,
                                name: streamName,
                                url: st.streamUrl,
                                behaviorHints: {
                                    notWebReady: true,
                                    headers: { "Referer": st.referer },
                                },
                            });
                        }
                        console.log(`📺 VixSrc streams found: ${res.length}`);
                    }
                }
                
                console.log(`✅ Total streams returned: ${allStreams.length}`);
                return { streams: allStreams };
            } catch (error) {
                console.error('Stream extraction failed:', error);
                return { streams: [] };
            }
        }
    );

    return builder;
}

const customConfig = parseConfigFromArgs(process.argv[2]);
const builder = createBuilder(customConfig);
const app = createExpressApp(customConfig);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Addon server running on http://127.0.0.1:${PORT}`);
});
