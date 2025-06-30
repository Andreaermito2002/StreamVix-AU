![image](https://github.com/user-attachments/assets/11956b44-f742-42cc-a9f0-40fbb1c9de61)
# 🎬 StreamViX

Un addon per Stremio che estrae sorgenti streaming dal sito vixsrc per permetterti di guardare film e serie TV con la massima semplicità.

---

## ✨ Funzionalità Principali

* **✅ Supporto Film:** Trova flussi streaming per i film utilizzando il loro ID TMDB.
* **📺 Supporto Serie TV:** Trova flussi per ogni episodio di una serie TV, basandosi su ID TMDB e formato stagione/episodio.
* **🔗 Integrazione Perfetta:** Si integra meravigliosamente con l'interfaccia di Stremio per un'esperienza utente fluida.

---

## ⚙️ Installazione

Puoi installare StreamViX in tre modi diversi, a seconda delle tue esigenze.

Oppure usare questa versione, serve solo aggiungere la TMDB api key e MFP url e psw
https://streamvix-streamvix.hf.space
---

### 🚀 Metodo 1: Hugging Face (Consigliato per Tutti)

Questo metodo ti permette di avere la tua istanza personale dell'addon online, gratuitamente e con la massima semplicità.

#### Prerequisiti

* **Account Hugging Face:** Crea un account [qui](https://huggingface.co/join).
* **Chiave API di TMDB:** Ottienine una gratuitamente registrandoti su [The Movie Database (TMDB)](https://www.themoviedb.org/documentation/api).
* **URL MediaflowProxy (MFP):** Devi avere un'istanza di MediaflowProxy (o `unhide`) già deployata su Hugging Face. Assicurati che sia una versione aggiornata (post 10 Aprile).

#### Procedura di Installazione

1.  **Crea un Nuovo Space 🆕**
    * Vai su [Hugging Face](https://huggingface.co/) e accedi.
    * Clicca sul tuo profilo e poi su `New Space`.
    * **Space name:** Scegli un nome (es. `StreamViX-tuo-username`).
    * **Select the Space SDK:** Scegli `Docker`.
    * **Visibilità:** Assicurati che sia `Public`.
    * Clicca su `Create Space`.

2.  **Aggiungi i Secrets 🔐** (Opzionale se inseriti durate l'installazione)
    * Nel tuo nuovo Space, vai sulla scheda `Settings`.
    * Nella sezione `Variables and secrets`, clicca su `New secret`.
    * Aggiungi i seguenti tre secrets, uno alla volta, facendo attenzione a scrivere correttamente i nomi:
        * `Name: TMDB_API_KEY` -> `Value: la_tua_chiave_api_di_tmdb`
        * `Name: MFP_URL` -> `Value: l_url_della_tua_istanza_mfp` (es. `https://username-mfp.hf.space`, **senza la `/` finale**)
        * `Name: MFP_PSW` -> `Value: la_password_che_hai_impostato_per_mfp`
        * `name: BOTHLINK ` -> `Value: "false"   true o false (mostra entrambi i link MFP e DIRECT)`    

3.  **Configura il Dockerfile 📝**
    * Torna alla scheda `Files` del tuo Space.
    * Clicca su `Add file` e seleziona `Create a new file`.
    * Chiamalo `Dockerfile` (senza estensioni, con la "D" maiuscola).
    * Incolla all'interno il contenuto del [Dockerfile](https://github.com/qwertyuiop8899/StreamV/blob/main/Dockerfile) che trovi nel repository ufficiale di StreamViX.
    * Clicca su `Commit new file to main`.

4.  **Build e Deploy 🚀**
    * Hugging Face avvierà automaticamente la build del tuo addon. Puoi monitorare il processo nella scheda `Logs`.
    * Una volta che vedi lo stato "Running", il tuo addon è pronto!

5.  **Installa in Stremio 🎬**
    * Nella pagina principale del tuo Space, vedrai un pulsante per installare l'addon (solitamente "Install"). Cliccaci sopra per installarlo automaticamente.
    * In alternativa, copia l'URL del tuo Space (es. `https://tuo-username-streamvix.hf.space`) e aggiungi `/manifest.json` alla fine. Incolla l'URL completo in Stremio (nella sezione "Addon" -> "Installa da URL").

---

### 🐳 Metodo 2: Docker Compose (Avanzato / Self-Hosting)

Ideale se hai un server o una VPS e vuoi gestire l'addon tramite Docker.

#### Crea il file `docker-compose.yml`

Salva il seguente contenuto in un file chiamato `docker-compose.yml`:

```yaml
services:
  streamvix-addon:
    # Nome del servizio per il tuo addon
    build:
      # Specifica il percorso assoluto della directory dove si trovano
      # il codice sorgente e il Dockerfile sulla tua VPS.
      context: /home/pi/vix
      dockerfile: Dockerfile
      args:
        # Argomenti passati al Dockerfile durante la build per clonare il repo.
        # Puoi sovrascriverli con un file .env o da terminale.
        GIT_REPO_URL: ${GIT_REPO_URL:https://github.com/qwertyuiop8899/StreamV.git}
        GIT_BRANCH: ${GIT_BRANCH:-main}
    environment:
      TMDB_API_KEY: ""
    ports:
      # Mappa la porta 7860 del container a quella della tua VPS.
      # Assicurati che la porta non sia già in uso.
      - "7860:7860"
    env_file:
      # Specifica il percorso assoluto del tuo file .env sulla VPS.
      # Docker caricherà le variabili (TMDB_API_KEY, etc.) da questo file.
      - /home/pi/vix/.env
    # Il comando da eseguire all'avvio del container.
    # Corrisponde allo script "start" nel package.json.
    command: pnpm start
    restart: unless-stopped # Opzionale: riavvia automaticamente il container.

```
#### Prepara la tua VPS

Assicurati che i percorsi `context` e `env_file` nel file `docker-compose.yml` siano corretti e corrispondano alla struttura delle tue directory sulla VPS.
Crea un file `.env` nel percorso specificato (es. `/home/pi/vix/.env`) e inserisci le tue variabili ( `TMDB_API_KEY`, `MFP_URL`, `MFP_PSW`). Ecco un esempio di `.env`:

```env
TMDB_API_KEY="la_tua_chiave_api_di_tmdb"
MFP_URL="https://username-mfp.hf.space"
MFP_PSW="la_tua_password_mfp"
PORT="portacustom"
BOTHLINK="false"
```
#### Esegui Docker Compose

Apri un terminale nella directory dove hai salvato il `docker-compose.yml` ed esegui il seguente comando per costruire l'immagine e avviare il container in background:

```bash
docker compose up -d --build
```

### 💻 Metodo 3: Installazione Locale (per Sviluppatori)

Usa questo metodo se vuoi modificare il codice sorgente, testare nuove funzionalità o contribuire allo sviluppo di StreamViX.

1.  **Clona il repository:**

    ```bash
    git clone [https://github.com/qwertyuiop8899/StreamV.git](https://github.com/qwertyuiop8899/StreamV.git) # Assicurati che sia il repository corretto di StreamViX
    cd vix # Entra nella directory del progetto appena clonata
    ```

2.  **Installa le dipendenze:**
3.  
    ```bash
    pnpm install
    ```
4.  **Setup:**

Crea il file `.env`: Crea un file chiamato `.env` nella root del progetto (nella stessa directory dove si trova `package.json`) e inserisci le variabili necessarie, come nell'esempio per Docker Compose:


    TMDB_API_KEY=la_tua_chiave_api_di_tmdb
    MFP_URL=[https://username-mfp.hf.space](https://username-mfp.hf.space)
    MFP_PSW=la_tua_password_mfp
    PORT="portacustom"
    BOTHLINK="true"   true o false (mostra entrambi i link MFP e DIRECT)    


4.  **Compila il progetto:**
    ```
    pnpm run build
    ```
5.  **Avvia l'addon:**
    ```
    pnpm start
    ```
L'addon sarà disponibile localmente all'indirizzo `http://localhost:56245`.


#### ⚠️ Disclaimer

Questo progetto è inteso esclusivamente a scopo educativo. L'utente è l'unico responsabile dell'utilizzo che ne fa. Assicurati di rispettare le leggi sul copyright e i termini di servizio delle fonti utilizzate.


## Credits

Original extraction logic written by https://github.com/mhdzumair for the extractor code https://github.com/mhdzumair/mediaflow-proxy 
Thanks to https://github.com/ThEditor https://github.com/ThEditor/stremsrc for the main code and stremio addon

