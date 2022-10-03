rm -rf /srv/dump
cd /srv && tar -xvf dump.tar
mongorestore --host localhost:27017 --username=test --authenticationDatabase=admin --drop /srv/dump/knightlands
cd /srv/knightlands-server && pm2 stop kl && pm2 start ecosystem.config.js