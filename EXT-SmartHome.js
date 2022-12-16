/**************************
*  EXT-SmartHome v1.0     *
*  Bugsounet              *
*  12/2022                *
***************************/

Module.register("EXT-SmartHome", {
  defaults: {
    debug: false,
    CLIENT_ID: null,
    CLIENT_SECRET: null,
    API_KEY: null,
    port: 5000
  },

  start: function() {

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
      case "EXT_SCREEN-ON":
        this.sendSocketNotification("SCREEN","ON")
        break
      case "EXT_SCREEN-OFF":
        this.sendSocketNotification("SCREEN","OFF")
        break
    }
  },

  socketNotificationReceived: function(noti, payload) {
    switch(noti) {
      case "SCREEN":
        if (payload == "ON") this.sendNotification("EXT_SCREEN-WAKEUP")
        if (payload == "OFF") this.sendNotification("EXT_SCREEN-END")
        break
    }
  }
});
