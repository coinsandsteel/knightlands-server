rm -rf /srv/dump
mongorestore --host localhost:27017 --db=knightlands --username=test --authenticationDatabase=admin --drop /srv/dump/knightlands