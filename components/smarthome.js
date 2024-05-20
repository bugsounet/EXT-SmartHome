"use strict";

//const util = require("node:util");
//const { exec, spawn } = require("node:child_process");


//const session = require("express-session");



const fs = require("node:fs");
const http = require("node:http");
const GoogleAuthLibrary = require("google-auth-library");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

var log = (...args) => { /* do nothing */ };

class smarthome {
  constructor (config, cb = () => {}) {
    this.config = config;
    this.sendSocketNotification = (...args) => cb.sendSocketNotification(...args);

    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME]", ...args); };

    this.smarthome = {
      user: { username: "admin", password: "admin" },
      use: false,
      app: null,
      server: null,
      initialized: false
    };
    this.root_path = global.root_path;
    this.SmartHomeWebsitePath = `${this.root_path}/modules/EXT-SmartHome/website`;
    this.SmartHomeModulePath = `${this.root_path}/modules/EXT-SmartHome`;
  }

  init () {
    console.log("[SMARTHOME] Loading SmartHome...");
    return new Promise((resolve) => {
      if (!this.config.username && !this.config.password) {
        console.error("[SMARTHOME] Your have not defined user/password in config!");
        console.error("[SMARTHOME] Using default credentials");
      } else {
        if ((this.config.username === this.smarthome.user.username) || (this.config.password === this.smarthome.user.password)) {
          console.warn("[SMARTHOME] WARN: You are using default username or default password");
          console.warn("[SMARTHOME] WARN: Don't forget to change it!");
        }
        this.smarthome.user.username = this.config.username;
        this.smarthome.user.password = this.config.password;
      }

      let file = `${this.SmartHomeModulePath}/smarthome.json`;
      fs.readFile(file, "utf8", (err, data) => {
        let content;
        if (!data) {
          console.error("[SMARTHOME] smarthome.json: file not found!");
          this.send("Alert", "smarthome.json: file not found!");
          resolve();
          return;
        }

        try {
          content = JSON.parse(data);
        } catch (e) {
          console.error("[SMARTHOME] smarthome.json: corrupt!");
          this.send("Alert", "smarthome.json: corrupt!");
          resolve();
          return;
        }
        if (content?.type === "service_account") {
          this.SmartHome.homegraph = googleapis.google.homegraph({
            version: "v1",
            auth: new GoogleAuthLibrary.GoogleAuth({
              keyFile: file,
              scopes: ["https://www.googleapis.com/auth/homegraph"]
            })
          });
          if (!this.config.CLIENT_ID) {
            console.error("[SMARTHOME] CLIENT_ID not defined in config!");
            this.send("Alert", "CLIENT_ID not defined in config!");
          } else {
            this.smarthome.use = true;
          }
        } else {
          console.error("[SMARTHOME] smarthome.json: bad format!");
          this.send("Alert", "smarthome.json: bad format!");
        }
        resolve();
      });
    });
  }

  createMiddleware () {
    console.log("[SMARTHOME] Create Middleware...");
    this.smarthome.app = express();
    this.smarthome.server = http.createServer(this.smarthome.app);
    var urlencodedParser = bodyParser.urlencoded({ extended: true });

    this.smarthome.app.use(bodyParser.json());
    this.smarthome.app.use(bodyParser.urlencoded({ extended: true }));

    var options = {
      dotfiles: "ignore",
      etag: false,
      extensions: ["css", "js"],
      index: false,
      maxAge: "1d",
      redirect: false,
      setHeaders (res) {
        res.set("x-timestamp", Date.now());
      }
    };

    this.smarthome.app
      .use(this.logRequest)
      .use(cors({ origin: "*" }))
      .use("/assets", express.static(`${this.SmartHomeWebsitePath}/assets`, options))

      .get("/robots.txt", (req, res) => {
        res.sendFile(`${this.SmartHomeWebsitePath}/robots.txt`);
      });

    if (this.smarthome.use) {
      this.smarthome.app
        .get("/login/", (req, res) => {
          if (this.SmartHome.use) res.sendFile(`${this.SmartHomeWebsitePath}/login.html`);
          else res.sendFile(`${this.SmartHomeWebsitePath}/disabled.html`);
        })

        .post("/login/", (req, res) => {
          let form = req.body;
          let args = req.query;
          if (form["username"] && form["password"] && args["state"] && args["response_type"] && args["response_type"] === "code" && args["client_id"] === this.config.CLIENT_ID) {
            let user = this.get_user(form["username"], form["password"]);
            if (!user) return res.sendFile("this.SmartHomePath}/login.html");
            this.SmartHome.last_code = this.random_string(8);
            this.SmartHome.last_code_user = form["username"];
            this.SmartHome.last_code_time = (new Date(Date.now())).getTime() / 1000;
            let params = {
              state: args["state"],
              code: this.SmartHome.last_code,
              client_id: this.config.CLIENT_ID
            };
            log("[AUTH] Generate Code:", this.SmartHome.last_code);
            res.status(301).redirect(args["redirect_uri"] + this.serialize(params));
          } else {
            res.status(400).sendFile(`${this.SmartHomePath}/400.html`);
          }
        })

        .post("/token/", (req, res) => {
          let form = req.body;
          if (form["grant_type"] && form["grant_type"] === "authorization_code" && form["code"] && form["code"] === this.SmartHome.last_code) {
            let time = (new Date(Date.now())).getTime() / 1000;
            if (time - this.SmartHome.last_code_time > 10) {
              log("[TOKEN] Invalid code (timeout)");
              res.status(403).sendFile(`${this.SmartHomeWebsitePath}/403.html`);
            } else {
              let access_token = this.random_string(32);
              fs.writeFileSync(`${this.tokensDir}/${access_token}`, this.SmartHome.last_code_user, { encoding: "utf8" });
              log("|TOKEN] Send Token:", access_token);
              res.json({ access_token: access_token });
            }
          } else {
            log("[TOKEN] Invalid code");
            res.status(403).sendFile(`${this.SmartHomeWebsitePath}/403.html`);
          }
        })

        /** fulfillment Server **/
        .get("/", (req, res) => {
          res.sendFile(`${this.SmartHomeWebsitePath}/works.html`);
        })

      //.post("/", this.SmartHome.actions)

        /** Display current google graph in console **/
        .get("/graph", (req, res) => {
          if (this.SmartHome.homegraph) this.queryGraph();
          res.status(404).sendFile(`${this.SmartHomeWebsitePath}/404.html`);
        });
    } else {
      this.smarthome.app
        .get("/login/", (req, res) => {
          res.sendFile(`${this.SmartHomeWebsitePath}/disabled.html`);
        })
        .get("/", (req, res) => {
          res.sendFile(`${this.SmartHomeWebsitePath}/disabled.html`);
        });
    }

    this.smarthome.app
      .get("/*", (req, res) => {
        console.warn("[SMARTHOME] Don't find:", req.url);
        res.status(404).sendFile(`${this.SmartHomeWebsitePath}/404.html`);
      });

    /** Create Server **/
    this.smarthome.server
      .listen(8083, "0.0.0.0", () => {
        console.log("[SMARTHOME] Start listening on port 8083");
        this.smarthome.initialized = true;
      })
      .on("error", (err) => {
        console.error("[SMARTHOME] Can't start web server!");
        console.error("[SMARTHOME] Error:", err.message);
        this.sendSocketNotification("SendNoti", {
          noti: "EXT_ALERT",
          payload: {
            type: "error",
            message: "Can't start web server!",
            timer: 10000
          }
        });
        this.smarthome.initialized = false;
      });
  }

  /** log any traffic **/
  logRequest (req, res, next) {
    var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    log(`[${ip}] [${req.method}] ${req.url}`);
    next();
  }

  /** callbacks **/
  send (name, values) {
    switch (name) {
      case "screen":
        log("[CALLBACK] Send screen:", values);
        this.sendSocketNotification("CB_SCREEN", values);
        break;
      case "volume":
        log("[CALLBACK] Send volume:", values);
        this.sendSocketNotification("CB_VOLUME", values);
        break;
      case "volumeMute":
        log("[CALLBACK] Send volume Mute:", values);
        this.sendSocketNotification("CB_VOLUME-MUTE", values);
        break;
      case "volumeUp":
        log("[CALLBACK] Send volume Up");
        this.sendSocketNotification("CB_VOLUME-UP");
        break;
      case "volumeDown":
        log("[CALLBACK] Send volume Down");
        this.sendSocketNotification("CB_VOLUME-DOWN");
        break;
      case "setPage":
        log("[CALLBACK] Send setInput:", values);
        this.sendSocketNotification("CB_SET-PAGE", values);
        break;
      case "setNextPage":
        log("[CALLBACK] Send setNextPage");
        this.sendSocketNotification("CB_SET-NEXT-PAGE");
        break;
      case "setPreviousPage":
        log("[CALLBACK] Send setPreviousPage");
        this.sendSocketNotification("CB_SET-PREVIOUS-PAGE");
        break;
      case "Alert":
        log("[CALLBACK] Send Alert:", values);
        this.sendSocketNotification("CB_ALERT", values);
        break;
      case "Done":
        log("[CALLBACK] Send Alert Done:", values);
        this.sendSocketNotification("CB_DONE", values);
        break;
      case "Reboot":
        log("[CALLBACK] Send Reboot");
        setTimeout(() => this.restart(), 8000);
        break;
      case "Locate":
        log("[CALLBACK] Send Locate");
        this.sendSocketNotification("CB_LOCATE");
        break;
      case "SpotifyPlay":
        log("[CALLBACK] Send SpotifyPlay");
        this.sendSocketNotification("CB_SPOTIFY-PLAY");
        break;
      case "SpotifyPause":
        log("[CALLBACK] Send SpotifyPause");
        this.sendSocketNotification("CB_SPOTIFY-PAUSE");
        break;
      case "SpotifyPrevious":
        log("[CALLBACK] Send SpotifyPrevious");
        this.sendSocketNotification("CB_SPOTIFY-PREVIOUS");
        break;
      case "SpotifyNext":
        log("[CALLBACK] Send SpotifyNext");
        this.sendSocketNotification("CB_SPOTIFY-NEXT");
        break;
      case "Stop":
        log("[CALLBACK] Send Stop");
        this.sendSocketNotification("CB_STOP");
        break;
      case "TVPlay":
        log("[CALLBACK] Send TVPlay");
        this.sendSocketNotification("CB_TV-PLAY");
        break;
      case "TVNext":
        log("[CALLBACK] Send TVNext");
        this.sendSocketNotification("CB_TV-NEXT");
        break;
      case "TVPrevious":
        log("[CALLBACK] Send TVPrevious");
        this.sendSocketNotification("CB_TV-PREVIOUS");
        break;
      case "SpotifyLyricsOn":
        log("[CALLBACK] Send Lyrics on");
        this.sendSocketNotification("CB_SPOTIFY-LYRICS-ON");
        break;
      case "SpotifyLyricsOff":
        log("[CALLBACK] Send Lyrics off");
        this.sendSocketNotification("CB_SPOTIFY-LYRICS-OFF");
        break;
      default:
        log("[CALLBACK] Unknow callback:", name);
        break;
    }
  }
}

module.exports = smarthome;
