rm -rf /srv/dump
tar -xvf /srv/dump.tar
cd /srv && mongorestore --host localhost:27017 --db=knightlands --username=test --authenticationDatabase=admin --drop
cd /srv/knightlands-server && pm2 stop kl && pm2 start ecosystem.config.js