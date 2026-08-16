docker run -d --name miaoma-aiflow -p 80:80 -p 443:443 -p 8080:8080 -v $PWD/conf:/etc/caddy -v caddy_data:/data caddy
