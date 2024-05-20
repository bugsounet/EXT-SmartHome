/******************************
* node_helper for EXT-Website *
* bugsounet ©05/24            *
******************************/

"use strict";
var log = (...args) => { /* do nothing */ };
const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
  start () {
    this.config = {};
    this.lib = { error: 0 };
  },

  async socketNotificationReceived (notification, payload) {
    switch (notification) {
      case "INIT":
        this.config = payload;
        this.initialize();
        break;
      case "SMARTHOME-INIT":
        var smarthome = await this.parseSmarthome();
        if (smarthome) await this.smarthome.init();
        this.website.server();
        this.sendSocketNotification("INITIALIZED");
        break;
      case "EXT_STATUS":
        console.log("Status",payload)
        if (this.smarthome) {
          //this.smarthome.setEXTStatus(payload);
          this.updateSmartHome();
        } else {
          // library is not loaded ... retry (not needed but...)
          setTimeout(() => { this.socketNotificationReceived("EXT_STATUS", payload); }, 1000);
        }
        break;
    }
  },

  async initialize () {
    console.log(`[SMARTHOME] EXT-SmartHome Version: ${require("./package.json").version} rev: ${require("./package.json").rev}`);
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME]", ...args); };
    await this.parseSmartHome();
    this.smarthome.init();
  },

  async parseSmartHome () {
    const bugsounet = await this.libraries("smarthome");
    return new Promise((resolve) => {
      if (bugsounet) return this.bugsounetError(bugsounet, "smarthome");
      let HelperConfig = {
        username: this.config.username,
        password: this.config.password,
        CLIENT_ID: this.config.CLIENT_ID,
        debug: this.config.debug,
        lang: config.language
      };

      let callbacks = {
        sendSocketNotification: (...args) => this.sendSocketNotification(...args),
        restart: () => {
          //this.website.restartMM()
          console.log("[SMARTHOME] Need Restart")
        }
      };

      this.smarthome = new this.lib.smarthome(HelperConfig, callbacks);
      resolve(true);
    });
  },

/*
  async parseSmarthome () {
    if (!this.config.CLIENT_ID) return false;
    const bugsounet = await this.libraries("smarthome");
    return new Promise((resolve) => {
      if (bugsounet) return this.bugsounetError(bugsounet, "Smarthome");

      let SmarthomeHelperConfig = {
        config: {
          username: this.config.username,
          password: this.config.password,
          CLIENT_ID: this.config.CLIENT_ID
        },
        debug: this.config.debug,
        lang: config.language,
        website: this.website
      };

      let smarthomeCallbacks = {
        sendSocketNotification: (...args) => {
          log("Smarthome callback:", ...args);
          this.sendSocketNotification(...args);
        },
        restart: () => this.website.restartMM()
      };

      this.smarthome = new this.lib.smarthome(SmarthomeHelperConfig, smarthomeCallbacks);
      resolve(true);
    });
  },
*/

  updateSmartHome () {
    if (!this.smarthome || !this.config.CLIENT_ID) return;
    if (this.smarthome.SmartHome.use && this.smarthome.SmartHome.init) {
      this.smarthome.refreshData();
      this.smarthome.updateGraph();
    }
  },

  libraries (type) {
    let Libraries = [];

    let smarthome = [
      { "./components/smarthome.js": "smarthome" }
    ];
    let errors = 0;

    switch (type) {
      case "smarthome":
        log("Loading smarhome Libraries...");
        Libraries = smarthome;
        break;
      default:
        console.log(`${type}: Unknow library database...`);
        return;
    }

    return new Promise((resolve) => {
      Libraries.forEach((library) => {
        for (const [name, configValues] of Object.entries(library)) {
          let libraryToLoad = name;
          let libraryName = configValues;

          try {
            if (!this.lib[libraryName]) {
              this.lib[libraryName] = require(libraryToLoad);
              log(`[LIB] Loaded: ${libraryToLoad} --> this.lib.${libraryName}`);
            }
          } catch (e) {
            //console.error(`[SMARTHOME] [LIB] ${libraryToLoad} Loading error!`, e.message);
            console.error(`[SMARTHOME] [LIB] ${libraryToLoad} Loading error!`, e);
            this.sendSocketNotification("ERROR", `Loading error! library: ${libraryToLoad}`);
            errors++;
            this.lib.error = errors;
          }
        }
      });
      resolve(errors);
      if (errors) {
        console.error("[SMARTHOME] [LIB] Some libraries missing!");
        //this.sendSocketNotification("NOT_INITIALIZED", { message: "Library loading Error!" });
      } else console.log(`[SMARTHOME] [LIB] All ${type} libraries loaded!`);
    });
  },

  bugsounetError (bugsounet, family) {
    console.error(`[SMARTHOME] [DATA] [${family}] Warning: ${bugsounet} needed library not loaded !`);
    console.error("[SMARTHOME] [DATA] Try to solve it with `npm run rebuild` in EXT-Website folder");
    this.sendSocketNotification("WARNING", `[${family}] Try to solve it with 'npm run rebuild' in EXT-Website folder`);
  }
});
