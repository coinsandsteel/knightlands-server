rm -rf ./dump
mongodump --db=knightlands --collection=battle_classes
mongodump --db=knightlands --collection=battle_units
mongodump --db=knightlands --collection=battle_abilities
mongodump --db=knightlands --collection=battle_effects
tar -cvf dump.tar dump
scp dump.tar root@178.128.118.165:/srv/dump.tar