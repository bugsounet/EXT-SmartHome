var colors = require("@colors/colors/safe");
const fs = require("fs");
const systemd= require("@bugsounet/systemd");

var server = `server {
  listen 80;

  server_name %domain%;

  location / {
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Host $http_host;
      proxy_set_header X-NginX-Proxy true;

      proxy_pass http://127.0.0.1:5000;
      proxy_redirect off;

      # Socket.IO Support
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
  }
}`
const Systemd = new systemd("nginx")

async function main() {
  const nginxStatus = await Systemd.status()
  if (nginxStatus.error) {
    console.error("[EXT-SMartHome] " + colors.red("Error: nginx is not installed!"))
    return process.exit(1)
  }
  console.log("[EXT-SmartHome] " + colors.cyan("Reading domaine name..."))
  fs.access(__dirname+"/DomainName", fs.constants.F_OK, (err) => {
    if (err)  {
      console.error("[EXT-SMartHome] " + colors.red("Error: domain name not found!"))
      process.exit(255)
    } else {
      fs.readFile(__dirname+"/DomainName", 'utf8', (err, data) => {
        if (err) {
          console.error("[EXT-SMartHome] " + colors.red("Error: " + err))
          process.exit(255)
        }
        nginx(data)
      });
    }
  })
}

function nginx (domain) {
  console.log("[EXT-SmartHome] " + colors.cyan("You said your domaine name is: " + domain))
  server = server.replace("%domain%", domain)
  console.log("[EXT-SmartHome] " + colors.cyan("Your nginx server configuration will be:"))
  console.log(server,"\n")
  console.log("[EXT-SmartHome] " + colors.cyan("Writing your configuration..."))
  fs.writeFile("/etc/nginx/sites-available/EXT-SmartHome", server, async (err, data) => {
    if (err) {
      console.error("[EXT-SMartHome] " + colors.red("Error:" + err.message))
      return process.exit(1)
    }
    console.log("[EXT-SmartHome] " + colors.cyan("OK\n"))
    
    console.log("[EXT-SmartHome] " + colors.cyan("Create Symlink..."))
    fs.access("/etc/nginx/sites-enabled/EXT-SmartHome", fs.constants.F_OK, (err) => {
      if (!err)  {
        console.log("[EXT-SMartHome] " + colors.cyan("Already created\n"))
        restartNginx()
      } else {
        fs.symlink("/etc/nginx/sites-available/EXT-SmartHome", "/etc/nginx/sites-enabled/EXT-SmartHome", 'file', async (err) => {
          if (err) {
            console.error("[EXT-SMartHome] " + colors.red("Error:" + err.message))
            return process.exit(1)
          }
          console.log("[EXT-SmartHome] " + colors.cyan("OK\n"))
          restartNginx()
        })
      }  
    })       
  })
}

async function restartNginx() {
  console.log("[EXT-SmartHome] " + colors.cyan("Restart nginx with new configuration..."))
  const nginxRestart = await Systemd.restart()
  if (nginxRestart.error) {
    console.error("[EXT-SMartHome] " + colors.red("Error when restart nginx!"))
    return process.exit(1)
  }
  console.log("[EXT-SmartHome] " + colors.cyan("OK\n"))
  console.log("[EXT-SmartHome] " + colors.yellow("Before you continue: Don't forget to forward ports 80 and 443 to your Pi's IP address!"))
}

main()
