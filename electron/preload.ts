const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("api", {
    ipcRenderer: ipcRenderer,
    mb_ipcRenderer: {
        sendMsg: (channel: any, data: any) => {
            // whitelist channels
            let validChannels = [
                "actions_to_main",
            ];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receiveMsg: (channel: any, func: any) => {
            let validChannels = [
                "product_count",
                "link_page_count",
                "rs_count",
            ];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender`
                const subscription = (event: any, ...args: any) => func(...args);
                ipcRenderer.on(channel, subscription);
                return () => {
                    ipcRenderer.removeListener(channel, subscription);
                }
            }
        },
        removeAllListeners: (channel: any) => {
            ipcRenderer.removeAllListeners(channel);
        },
        sendSyncMsg: (channel: any, data: any) => {
            return ipcRenderer.sendSync(channel, data);
        },
        invokeMsg: (channel: any, data: any) => {
            return ipcRenderer.invoke(channel, data);
        }
    }
});
