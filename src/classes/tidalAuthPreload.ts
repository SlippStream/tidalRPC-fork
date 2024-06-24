import { ipcRenderer } from "electron";

console.log("tidalAut: info: beginning import");
import("@tidal-music/auth").then((v) => {
    console.log(`id: ${process.env.clientId}`);
    v.init({
        clientId: process.env.clientId,
        clientSecret: process.env.clientSecret,
        credentialsStorageKey: "key",
        scopes: []
    }).then(() => {
        console.log("tidalAuthPreload: info: polling credentials provider");
        console.log(v.credentialsProvider)
        v.credentialsProvider.getCredentials().then((creds) => {
            console.log(creds);
            ipcRenderer.send('auth', creds);
        }).catch((r) => console.error(`tidalAuthPreload: error: ${r}`));
    }).catch((r) => console.error(`tidalAuthPreload: error: ${r}`));
});
