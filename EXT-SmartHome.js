/******************
* EXT-SmartHome
* bugsounet ©05/24
******************/

Module.register("EXT-SmartHome", {
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
      case "SendNoti":
        if (payload.payload && payload.noti) this.sendNotification(payload.noti, payload.payload);
        else this.sendNotification(payload);
        break;
    }
  },

  notificationReceived (notification, payload, sender) {
    switch (notification) {
      case "GA_READY":
        if (sender.name === "MMM-GoogleAssistant") this.websiteInit();
        break;
      case "EXT_STATUS":
        console.log("[SMARTHOME] EXT_STATUS", payload);
        this.sendSocketNotification("EXT_STATUS", payload);
        break;
    }
  },

  getDom () {
    var dom = document.createElement("div");
    dom.style.display = "none";
    return dom;
  },

  async websiteInit () {
    this.config.EXT_DB = this.EXT_DB;
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
