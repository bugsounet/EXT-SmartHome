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
});
