rm -rf /srv/dump
tar -xvf /srv/dump.tar
mongorestore --host localhost:27017 --db=knightlands --username=test --authenticationDatabase=admin --drop /srv/dump/knightlands
cd /srv/knightlands-server && pm2 stop kl && pm2 start ecosystem.config.js