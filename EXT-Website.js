/******************
* EXT-Website
* bugsounet ©05/24
******************/

Module.register("EXT-Website", {
  requiresVersion: "2.27.0",
  defaults: {
    debug: false,
    username: "admin",
    password: "admin",
    CLIENT_ID: null
  },

  start () {
    this.ready = false;
    this.config.translations = {};
    this.EXT_DB = [];
  },

  socketNotificationReceived (notification, payload) {
    if (notification.startsWith("CB_")) return this.callbacks(notification, payload);
    switch (notification) {
      case "INITIALIZED":
        this.ready = true;
        this.sendNotification("EXT_HELLO", this.name);
        break;
      case "WEBSITE-INIT":
        this.sendSocketNotification("SMARTHOME-INIT");
        break;
      case "SendNoti":
        console.log("---> SendNoti:", payload);
        if (payload.payload && payload.noti) this.sendNotification(payload.noti, payload.payload);
        else this.sendNotification(payload);
        break;
      case "SYSINFO-RESULT":
        this.sysInfo.updateSystemData(payload);
        break;
      case "TB_SYSINFO-RESULT":
        this.show_sysinfo(payload);
        break;
    }
  },

  notificationReceived (notification, payload, sender) {
    switch (notification) {
      case "GA_READY":
        if (sender.name === "MMM-GoogleAssistant") this.websiteInit();
        break;
      case "EXT_DB":
        this.EXT_DB = payload;
        console.log("[WEBSITE] Received Database", this.EXT_DB);
        break;
      case "EXT_DB-UPDATE":
        this.sendSocketNotification("EXT_DB-UPDATE", payload);
        break;
      case "EXT_STATUS":
        this.sendSocketNotification("EXT_STATUS", payload);
        break;
      case "EXT_WEBSITE-SYSINFO":
        this.sysInfo.toggle();
        break;
    }
  },

  getDom () {
    var dom = document.createElement("div");
    dom.style.display = "none";
    return dom;
  },

  getScripts () {
    return [
      "/modules/EXT-Website/components/WebsiteTranslations.js",
      "/modules/EXT-Website/components/sysInfoPage.js"
    ];
  },

  getTranslations () {
    return {
      en: "translations/en.json",
      de: "translations/de.json",
      es: "translations/es.json",
      fr: "translations/fr.json",
      it: "translations/it.json",
      nl: "translations/nl.json",
      tr: "translations/tr.json",
      "zh-cn": "translations/zh-cn.json"
    };
  },

  getStyles () {
    return ["/modules/EXT-Website/EXT-Website.css"];
  },

  async websiteInit () {
    const Tools = {
      translate: (...args) => this.translate(...args),
      sendNotification: (...args) => this.sendNotification(...args),
      sendSocketNotification: (...args) => this.sendSocketNotification(...args)
    };
    this.Translations = new WebsiteTranslations(Tools);
    let init = await this.Translations.init();
    if (!init) {
      this.sendNotification("EXT_ALERT", {
        message: "Translations Error",
        type: "error",
        timer: 5000
      });
      return;
    }
    this.session = {};
    this.config.EXT_DB = this.EXT_DB;
    this.config.translations.Description = this.Translations.Get_EXT_Description();
    this.config.translations.Translate = this.Translations.Get_EXT_Translation();
    this.config.translations.Schema = this.Translations.Get_EXT_TrSchemaValidation();
    this.sysInfo = new sysInfoPage(Tools);
    this.sysInfo.prepare();
    this.sendSocketNotification("INIT", this.config);
  },

  /** smarthome callbacks **/
  callbacks (noti, payload) {
    switch (noti) {
      case "CB_SCREEN":
        if (payload === "ON") this.sendNotification("EXT_SCREEN-FORCE_WAKEUP");
        else if (payload === "OFF") {
          this.sendNotification("EXT_STOP");
          this.sendNotification("EXT_SCREEN-FORCE_END");
        }
        break;
      case "CB_VOLUME":
        this.sendNotification("EXT_VOLUME-SPEAKER_SET", payload);
        break;
      case "CB_VOLUME-MUTE":
        this.sendNotification("EXT_VOLUME-SPEAKER_MUTE", payload);
        break;
      case "CB_VOLUME-UP":
        this.sendNotification("EXT_VOLUME-SPEAKER_UP", payload);
        break;
      case "CB_VOLUME-DOWN":
        this.sendNotification("EXT_VOLUME-SPEAKER_DOWN", payload);
        break;
      case "CB_SET-PAGE":
        this.sendNotification("EXT_PAGES-CHANGED", payload);
        break;
      case "CB_SET-NEXT-PAGE":
        this.sendNotification("EXT_PAGES-INCREMENT");
        break;
      case "CB_SET-PREVIOUS-PAGE":
        this.sendNotification("EXT_PAGES-DECREMENT");
        break;
      case "CB_ALERT":
        this.sendNotification("EXT_ALERT", {
          message: payload,
          type: "warning",
          timer: 10000
        });
        break;
      case "CB_DONE":
        this.sendNotification("EXT_ALERT", {
          message: payload,
          type: "information",
          timer: 5000
        });
        break;
      case "CB_LOCATE":
        this.sendNotification("EXT_ALERT", {
          message: "Hey, I'm here !",
          type: "information",
          sound: "modules/MMM-GoogleAssistant/website/tools/locator.mp3",
          timer: 19000
        });
        break;
      case "CB_SPOTIFY-PLAY":
        this.sendNotification("EXT_SPOTIFY-PLAY");
        break;
      case "CB_SPOTIFY-PAUSE":
        this.sendNotification("EXT_SPOTIFY-PAUSE");
        break;
      case "CB_SPOTIFY-PREVIOUS":
        this.sendNotification("EXT_SPOTIFY-PREVIOUS");
        break;
      case "CB_SPOTIFY-NEXT":
        this.sendNotification("EXT_SPOTIFY-NEXT");
        break;
      case "CB_STOP":
        this.notificationReceived("EXT_STOP");
        this.sendNotification("EXT_STOP");
        break;
      case "CB_TV-PLAY":
        this.sendNotification("EXT_FREEBOXTV-PLAY");
        break;
      case "CB_TV-NEXT":
        this.sendNotification("EXT_FREEBOXTV-NEXT");
        break;
      case "CB_TV-PREVIOUS":
        this.sendNotification("EXT_FREEBOXTV-PREVIOUS");
        break;
      case "CB_SPOTIFY-LYRICS-ON":
        this.sendNotification("EXT_SPOTIFY-SCL", true);
        break;
      case "CB_SPOTIFY-LYRICS-OFF":
        this.sendNotification("EXT_SPOTIFY-SCL", false);
        break;
    }
  },

  /********************************/
  /*** EXT-TelegramBot Commands ***/
  /********************************/
  EXT_TELBOTCommands (commander) {
    commander.add({
      command: "sysinfo",
      description: this.translate("TB_SYSINFO_DESCRIPTION"),
      callback: "cmd_sysinfo"
    });
  },

  cmd_sysinfo (command, handler) {
    if (handler.args) {
      var args = handler.args.toLowerCase().split(" ");
      var params = handler.args.split(" ");
      if (args[0] === "show") {
        this.sysInfo.show();
        handler.reply("TEXT", "ok.");
        return;
      }
      if (args[0] === "hide") {
        this.sysInfo.hide();
        handler.reply("TEXT", "ok.");
        return;
      }
    }

    // try to manage session ...
    let chatId = handler.message.chat.id;
    let userId = handler.message.from.id;
    let messageId = handler.message.message_id;
    let sessionId = `${messageId}:${userId}:${chatId}`;
    this.session[sessionId] = handler;
    this.sendSocketNotification("TB_SYSINFO", sessionId);
  },

  show_sysinfo (result) {
    let session = result.sessionId;
    let handler = this.session[session];
    if (!handler || !session) return console.error("[Gateway] TB session not found!", handler, session);
    var text = "";
    text += `*${result["HOSTNAME"]}*\n\n`;
    // version
    text += `*-- ${this.translate("GW_System_Box_Version")} --*\n`;
    text += "*" + `MMM-GoogleAssistant:* \`${result["VERSION"]["GA"]}\`\n`;
    text += "*" + `MagicMirror²:* \`${result["VERSION"]["MagicMirror"]}\`\n`;
    text += "*" + `Electron:* \`${result["VERSION"]["ELECTRON"]}\`\n`;
    text += "*" + `MagicMirror² ${this.translate("GW_System_NodeVersion")}* \`${result["VERSION"]["NODEMM"]}\`\n`;
    text += `*${this.translate("GW_System_NodeVersion")}* \`${result["VERSION"]["NODECORE"]}\`\n`;
    text += `*${this.translate("GW_System_NPMVersion")}* \`${result["VERSION"]["NPM"]}\`\n`;
    text += `*${this.translate("GW_System_OSVersion")}* \`${result["VERSION"]["OS"]}\`\n`;
    text += `*${this.translate("GW_System_KernelVersion")}* \`${result["VERSION"]["KERNEL"]}\`\n`;
    // GPU
    text += "*-- GPU --*\n";
    let GPU_INFO = result.GPU ? this.translate("GW_System_GPUAcceleration_Enabled") : (`WARN: ${this.translate("GW_System_GPUAcceleration_Disabled")}`);
    text += `*${GPU_INFO}*\n`;
    // CPU
    text += `*-- ${this.translate("GW_System_CPUSystem")} --*\n`;
    text += `*${this.translate("GW_System_TypeCPU")}* \`${result["CPU"]["type"]}\`\n`;
    text += `*${this.translate("GW_System_SpeedCPU")}* \`${result["CPU"]["speed"]}\`\n`;
    text += `*${this.translate("GW_System_CurrentLoadCPU")}* \`${result["CPU"]["usage"]}%\`\n`;
    text += `*${this.translate("GW_System_GovernorCPU")}* \`${result["CPU"]["governor"]}\`\n`;
    text += `*${this.translate("GW_System_TempCPU")}* \`${config.units === "metric" ? result["CPU"]["temp"]["C"] : result["CPU"]["temp"]["F"]}°\`\n`;
    // memory
    text += `*-- ${this.translate("GW_System_MemorySystem")} --*\n`;
    text += `*${this.translate("GW_System_TypeMemory")}* \`${result["MEMORY"]["used"]} / ${result["MEMORY"]["total"]} (${result["MEMORY"]["percent"]}%)\`\n`;
    text += `*${this.translate("GW_System_SwapMemory")}* \`${result["MEMORY"]["swapUsed"]} / ${result["MEMORY"]["swapTotal"]} (${result["MEMORY"]["swapPercent"]}%)\`\n`;
    // network
    text += `*-- ${this.translate("GW_System_NetworkSystem")} --*\n`;
    text += `*${this.translate("GW_System_IPNetwork")}* \`${result["NETWORK"]["ip"]}\`\n`;
    text += `*${this.translate("GW_System_InterfaceNetwork")}* \`${result["NETWORK"]["name"]} (${result["NETWORK"]["type"] === "wired" ? this.translate("TB_SYSINFO_ETHERNET") : this.translate("TB_SYSINFO_WLAN")})\`\n`;
    if (result["NETWORK"]["type"] === "wired") {
      text += `*${this.translate("GW_System_SpeedNetwork")}* \`${result["NETWORK"]["speed"]} Mbit/s\`\n`;
      text += `*${this.translate("GW_System_DuplexNetwork")}* \`${result["NETWORK"]["duplex"]}\`\n`;
    } else {
      text += `*${this.translate("GW_System_WirelessInfo")}:*\n`;
      text += `*  ${this.translate("GW_System_SSIDNetwork")}* \`${result["NETWORK"]["ssid"]}\`\n`;
      text += `*  ${this.translate("GW_System_FrequencyNetwork")}* \`${result["NETWORK"]["frequency"]} GHz\`\n`;
      text += `*  ${this.translate("GW_System_RateNetwork")}* \`${result["NETWORK"]["rate"]} Mb/s\`\n`;
      text += `*  ${this.translate("GW_System_QualityNetwork")}* \`${result["NETWORK"]["quality"]}\`\n`;
      text += `*  ${this.translate("GW_System_SignalNetwork")}* \`${result["NETWORK"]["signalLevel"]} dBm (${result["NETWORK"]["barLevel"]})\`\n`;
    }
    // storage
    text += `*-- ${this.translate("GW_System_StorageSystem")} --*\n`;
    result["STORAGE"].forEach((partition) => {
      for (let [name, values] of Object.entries(partition)) {
        text += `*${this.translate("GW_System_MountStorage")} ${name}:* \`${values.used} / ${values.size} (${values.use}%)\`\n`;
      }
    });
    // uptimes
    text += `*-- ${this.translate("GW_System_UptimeSystem")} --*\n`;
    text += `*${this.translate("GW_System_CurrentUptime")}:*\n`;
    text += `*  ${this.translate("GW_System_System")}* \`${result["UPTIME"]["currentDHM"]}\`\n`;
    text += `*  MagicMirror²:* \`${result["UPTIME"]["MMDHM"]}\`\n`;
    text += `*${this.translate("GW_System_RecordUptime")}:*\n`;
    text += `*  ${this.translate("GW_System_System")}* \`${result["UPTIME"]["recordCurrentDHM"]}\`\n`;
    text += `*  MagicMirror²:* \`${result["UPTIME"]["recordMMDHM"]}\`\n`;

    handler.reply("TEXT", text, { parse_mode: "Markdown" });
    delete this.session[session];
  }
});
