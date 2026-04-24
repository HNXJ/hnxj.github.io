FROM nginx:alpine
COPY default.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
