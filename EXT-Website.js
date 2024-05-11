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
    this.config.translations = {}
    this.EXT_DB = []
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
        console.log("---> SendNoti:", payload)
        if (payload.payload && payload.noti) this.sendNotification(payload.noti, payload.payload);
        else this.sendNotification(payload);
        break;
    }
  },

  notificationReceived (notification, payload, sender) {
    switch (notification) {
      case "GA_READY":
        if (sender.name === "MMM-GoogleAssistant") this.Translation_Config();
        break;
      case "EXT_DB":
        this.EXT_DB = payload
        console.log("[WEBSITE] Received Database", this.EXT_DB)
        break;
      case "EXT_DB-UPDATE":
        this.sendSocketNotification("EXT_DB-UPDATE", payload)
        break;
      case "EXT_STATUS":
        this.sendSocketNotification("EXT_STATUS", payload)
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
      //"/modules/MMM-GoogleAssistant/components/sysInfoPage.js"
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

  async Translation_Config () {
    const Tools = {
      translate: (...args) => this.translate(...args),
      //sendNotification: (...args) => this.sendNotification(...args),
      //sendSocketNotification: (...args) => this.sendSocketNotification(...args),
      //socketNotificationReceived: (...args) => this.socketNotificationReceived(...args),
      //notificationReceived: (...args) => this.notificationReceived(...args),
      //lock: () => this.EXTs.forceLockPagesAndScreen(),
      //unLock: () => this.EXTs.forceUnLockPagesAndScreen()
    };
    this.Translations = new WebsiteTranslations(Tools);
    let init = await this.Translations.init();
    if (!init) return; // <--- display error (EXT ALERT)
    //this.session = {}; // <-- for TB
    //this.sysInfo = new sysInfoPage(Tools);
    //this.sysInfo.prepare();
    this.config.EXT_DB = this.EXT_DB
    this.config.translations.Description = this.Translations.Get_EXT_Description()
    this.config.translations.Translate = this.Translations.Get_EXT_Translation()
    this.config.translations.Schema = this.Translations.Get_EXT_TrSchemaValidation()
    this.sendSocketNotification("INIT", this.config)
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
  }
});
