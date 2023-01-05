"use strict"

var log = () => { /* do nothing */ }

const path = require("path")
const fs = require("fs")
var express = require("express")
const http = require('http')
const bodyParser = require('body-parser')
const actions = require("../components/actions.js")
const homegraph = require("../components/homegraph.js")

class SERVER {
  constructor(config, cb = ()=>{}) {
    this.config = config
    this.callback = cb
    if (this.config.debug) log = (...args) => { console.log("[SMARTHOME] [SERVER]", ...args) }
    this.tokensDir = path.resolve(__dirname + "/../tokens/")
    this.websiteDir =  path.resolve(__dirname + "/../website/")
    this.last_code = null
    this.last_code_user = null
    this.last_code_time = null
    this.app = express()
    this.server = http.createServer(this.app)
    this.actions = new actions(this.config, this.callback)
    this.homegraph = null
    log("Loaded!")
  }

  start() {
    console.log("[SMARTHOME] [SERVER] Starting Server...")
    this.actions.actionsOnGoogle()
    var options = {
      dotfiles: 'ignore',
      etag: false,
      extensions: ["css", "js"],
      index: false,
      maxAge: '1d',
      redirect: false,
      setHeaders: function (res, path, stat) {
        res.set('x-timestamp', Date.now())
      }
    }
    this.app
      .use(this.logRequest)
      .use('/css', express.static(this.websiteDir))
      .use('/assets', express.static(this.websiteDir + '/assets', options))
      .use(bodyParser.json())
      .use(bodyParser.urlencoded({ extended: true }))
      .use(express.json())

      /** OAuth2 Server **/
      .get("/auth/", (req,res) => {
        res.sendFile(this.websiteDir+ "/login.html")
      })

      .post("/auth/", (req,res) => {
        let form = req.body
        let args = req.query
        if (form["username"] && form["password"] && args["state"] && args["response_type"] && args["response_type"] == "code" && args["client_id"] == this.config.CLIENT_ID){
          let user = this.actions.tools.get_user(form["username"])
          if (!user || this.actions.tools.user.password != form["password"]) {
            return res.sendFile(this.websiteDir+ "/login.html")
          }
          this.last_code = this.actions.tools.random_string(8)
          this.last_code_user = form["username"]
          this.last_code_time = (new Date()).getTime() / 1000
          let params = {
            'state': args["state"],
            'code': this.last_code,
            'client_id': this.config.CLIENT_ID
          }
          log("[AUTH] Generate Code", this.last_code)
          res.status(301).redirect(args["redirect_uri"] + this.actions.tools.serialize(params))
        } else {
          res.status(400).sendFile(this.websiteDir+ "/400.html")
        }
      })

      .post("/token/", (req,res) => {
        let form = req.body
        if (form["grant_type"] && form["grant_type"] == "authorization_code" && form["code"] && form["code"] == this.last_code) {
          let time = (new Date()).getTime() / 1000
          if (time - this.last_code_time > 10) {
            log("[TOKEN] Invalid code (timeout)")
            res.status(403).sendFile(this.websiteDir+ "/403.html")
          } else {
            let access_token = this.actions.tools.random_string(32)
            fs.writeFileSync(this.tokensDir + "/" + access_token, this.last_code_user, { encoding: "utf8"} )
            log("|TOKEN] Send Token:", access_token)
            res.json({"access_token": access_token})
          }
        } else {
          log("[TOKEN] Invalid code")
          res.status(403).sendFile(this.websiteDir+ "/403.html")
        }
      })

      /** fulfillment Server **/
      .get("/", (req,res) => {
        res.sendFile(this.websiteDir+ "/works.html")
      })

      .post("/", this.actions.smarthome)

      /** Display current google graph in console **/
      .get("/graph",(req,res) => {
        this.homegraph.queryGraph()
        res.status(404).sendFile(this.websiteDir+ "/404.html")
      })

      .use((req, res) => {
        log("[404]", req.url, req.body)
        res.status(404).sendFile(this.websiteDir+ "/404.html")
      })

    this.server.listen(this.config.port, "127.0.0.1", async () => {
      console.log("[SMARTHOME] [SERVER] Start listening on http://127.0.0.1:"+this.config.port)
      this.homegraph = new homegraph(this.config, this.callback)
      this.homegraph.requestSync()
    })
  }

  /** Tools **/
  logRequest(req, res, next) {
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    log("[" + req.method + "] [" + ip + "] " + req.url)
    next()
  }

  /** DataBase update **/
  refreshDB(data) {
    this.actions.refreshData(data)
    this.homegraph.updateGraph(
      this.actions.getEXT(),
      this.actions.getCurrentSmarthome(),
      this.actions.getOldSmartHome()
    )
  }

  /** Search installed plugins and set any values **/
  set(GW) {
    this.actions.setDevice(GW)
  }
}

module.exports = SERVER
