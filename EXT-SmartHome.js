/**************************
*  EXT-SmartHome v1.0     *
*  Bugsounet              *
*  12/2022                *
***************************/

Module.register("EXT-SmartHome", {
  defaults: {
    debug: false,
    username: "MagicMirror",
    password: "admin",
    CLIENT_ID: null,
    CLIENT_SECRET: null,
    port: 5000
  },

  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.style.display = 'none'
    return wrapper
  },

  notificationReceived: function(noti, payload, sender) {
    switch(noti) {
      case "DOM_OBJECTS_CREATED":
        this.getLanguageBeforeInit()
        break
      case "GAv4_READY": // send HELLO to Gateway ... (mark plugin as present in GW db)
        if (sender.name == "MMM-GoogleAssistant") this.sendNotification("EXT_HELLO", this.name)
        break
      case "EXT_GATEWAY-STATUS":
        this.sendSocketNotification("GATEWAYDB", payload)
        break
    }
  },

  socketNotificationReceived: function(noti, payload) {
    switch(noti) {
      case "SCREEN":
        if (payload == "ON") {
          this.sendNotification("EXT_SCREEN-FORCE_UNLOCK")
          this.sendNotification("EXT_SCREEN-WAKEUP")
        }
        if (payload == "OFF") {
          this.sendNotification("EXT_SCREEN-FORCE_UNLOCK")
          this.sendNotification("EXT_SCREEN-END")
          setTimeout(() => { this.sendNotification("EXT_SCREEN-FORCE_LOCK") } , 1000)
        }
        break
      case "VOLUME":
        this.sendNotification("EXT_VOLUME-SPEAKER_SET", payload)
        break
      case "VOLUME-UP":
        this.sendNotification("EXT_VOLUME-SPEAKER_UP", payload)
        break
      case "VOLUME-DOWN":
        this.sendNotification("EXT_VOLUME-SPEAKER_DOWN", payload)
        break
      case "SET-PAGE":
        this.sendNotification("EXT_PAGES-CHANGED", payload)
        break
      case "SET-NEXT-PAGE":
        this.sendNotification("EXT_PAGES-INCREMENT")
        break
      case "SET-PREVIOUS-PAGE":
        this.sendNotification("EXT_PAGES-DECREMENT")
        break
      case "ALERT":
        this.sendNotification("EXT_ALERT", {
          message: payload,
          type: "warning",
          timer: 10000
        })
        break
      case "REBOOT":
        this.sendNotification("EXT_GATEWAY-REBOOT")
        break
      case "LOCATE":
        this.sendNotification("EXT_ALERT", {
          message: "Hey, I'm here !",
          type: "information",
          sound: "modules/EXT-SmartHome/components/locator.mp3",
          timer: 19000
        })
        break
      case "SPOTIFY-PLAY":
        this.sendNotification("EXT_SPOTIFY-PLAY")
        break
      case "SPOTIFY-PAUSE":
        this.sendNotification("EXT_SPOTIFY-PAUSE")
        break
      case "SPOTIFY-PREVIOUS":
        this.sendNotification("EXT_SPOTIFY-PREVIOUS")
        break
      case "SPOTIFY-NEXT":
        this.sendNotification("EXT_SPOTIFY-NEXT")
        break
      case "STOP":
        this.sendNotification("EXT_STOP")
        break
    }
  },

  getLanguageBeforeInit: function() {
    switch (config.language) {
      case "da":
      case "nl":
      case "en":
      case "fr":
      case "de":
      case "hi":
      case "id":
      case "it":
      case "ja":
      case "ko":
      case "es":
      case "sv":
        this.config.lang = config.language
        break
      case "pt":
      case "pt-br":
        this.config.lang = "pt-BR"
        break
      case "zh-tw":
        this.config.lang = "zh-TW"
        break
      case "nb":
      case "nn":
        this.config.lang = "no"
        break
      //case "th": ?? Tha?? (th)
      default:
        this.config.lang = "en"
        break
    }
    this.sendSocketNotification("INIT", this.config)
  }
});
