FROM node:8.11.3
ARG VERSION_TAG
RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-IPMessagingAPI.git /usr/local/src/ipmessagingapi
RUN cd /usr/local/src/ipmessagingapi;
WORKDIR /usr/local/src/ipmessagingapi
RUN npm install
EXPOSE 6689 6690
CMD [ "node", "/usr/local/src/ipmessagingapi/app.js" ]
