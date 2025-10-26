### Close the port
1. netstat -ano | findstr :3000
2. Get output
TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345

3. Close 
taskkill /PID 12345 /F
