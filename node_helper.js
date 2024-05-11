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
        this.sendSocketNotification("INITIALIZED")
        break;
      case "EXT_DB-UPDATE":
        if (this.website) this.website.setActiveVersion(payload);
        else {
          // library is not loaded
          setTimeout(() => { this.socketNotificationReceived("EXT_DB-UPDATE", payload); }, 1000);
        }
        break;
      case "EXT_STATUS":
        if (this.website) {
          log("Received Status:") //, payload);
          this.website.setEXTStatus(payload);
          //this.updateSmartHome();
        } else {
          // library is not loaded ... retry (not needed but...)
          setTimeout(() => { this.socketNotificationReceived("EXT_STATUS", payload); }, 1000);
        }
        break;
    }
  },

  async initialize () {
    console.log(`[WEBSITE] EXT-Website Version: ${require("./package.json").version} rev: ${require("./package.json").rev}`);
    if (this.config.debug) log = (...args) => { console.log("[WEBSITE]", ...args); };
    await this.parseWebsite();
    this.lib.HyperWatch.enable();
    this.website.init(this.config);
  },

  async parseWebsite () {
    const bugsounet = await this.libraries("website");
    return new Promise((resolve) => {
      if (bugsounet) return this.bugsounetError(bugsounet, "Website");
      let WebsiteHelperConfig = {
        config: {
          username: this.config.username,
          password: this.config.password
        },
        debug: this.config.debug,
        lib: this.lib
      };

      this.website = new this.lib.website(WebsiteHelperConfig, (...args) => this.sendSocketNotification(...args));
      resolve();
    });
  },

  async parseSmarthome () {
    if (!this.config.CLIENT_ID) return false;
    const bugsounet = await this.libraries("smarthome");
    return new Promise((resolve) => {
      if (bugsounet) return this.bugsounetError(bugsounet, "Smarthome");

      let SmarthomeHelperConfig = {
        config: this.config.website,
        debug: this.config.debug,
        lang: config.language,
        website: this.website
      };

      let smarthomeCallbacks = {
        sendSocketNotification: (...args) => this.sendSocketNotification(...args),
        restart: () => this.website.restartMM()
      };

      this.smarthome = new this.lib.smarthome(SmarthomeHelperConfig, smarthomeCallbacks);
      resolve(true);
    });
  },

  libraries (type) {
    let Libraries = [];

    let website = [
      { "./components/hyperwatch.js": "HyperWatch" },
      { "./components/systemInformation.js": "SystemInformation" },
      { "./components/website.js": "website" }
    ];

    let smarthome = [
      { "./components/smarthome.js": "smarthome" }
    ];
    let errors = 0;

    switch (type) {
      case "website":
        log("Loading website Libraries...");
        Libraries = website;
        break;
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
            //console.error(`[WEBSITE] [LIB] ${libraryToLoad} Loading error!`, e.message);
            console.error(`[WEBSITE] [LIB] ${libraryToLoad} Loading error!`, e);
            this.sendSocketNotification("ERROR", `Loading error! library: ${libraryToLoad}`);
            errors++;
            this.lib.error = errors;
          }
        }
      });
      resolve(errors);
      if (errors) {
        console.error("[WEBSITE] [LIB] Some libraries missing!");
        //this.sendSocketNotification("NOT_INITIALIZED", { message: "Library loading Error!" });
      } else console.log(`[WEBSITE] [LIB] All ${type} libraries loaded!`);
    });
  },

  bugsounetError (bugsounet, family) {
    console.error(`[WEBSITE] [DATA] [${family}] Warning: ${bugsounet} needed library not loaded !`);
    console.error("[WEBSITE] [DATA] Try to solve it with `npm run rebuild` in EXT-Website folder");
    this.sendSocketNotification("WARNING", `[${family}] Try to solve it with 'npm run rebuild' in EXT-Website folder`);
  },
});
