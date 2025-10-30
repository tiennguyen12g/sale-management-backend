@echo off
echo Starting MongoDB with replica set...
"C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" ^
  --dbpath "C:\Program Files\MongoDB\Server\8.0\data" ^
  --replSet rs0 ^
  --port 27017 ^
  --bind_ip 127.0.0.1
pause
