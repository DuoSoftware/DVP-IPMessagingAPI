#EXPOSE 8828

# FROM node:9.9.0
# ARG VERSION_TAG
# RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-ARDSLiteService.git /usr/local/src/ardsliteservice
# RUN cd /usr/local/src/ardsliteservice;
# WORKDIR /usr/local/src/ardsliteservice
# RUN npm install
# EXPOSE 8828
# CMD [ "node", "/usr/local/src/ardsliteservice/app.js" ]


FROM node:16-alpine
WORKDIR /usr/local/src/ipmessagingapi
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 6689 6690
CMD [ "node", "app.js" ]
