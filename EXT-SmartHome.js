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
    API_KEY: null,
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
        this.sendSocketNotification("INIT", this.config)
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
    }
  }
});
