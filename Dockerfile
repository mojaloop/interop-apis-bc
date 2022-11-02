########################################
FROM node:16.13-alpine as builder

# Create app directory
WORKDIR /app

# build requirements
RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python3 libtool libressl-dev openssl-dev autoconf automake bash wget tar xz \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

COPY packages/fspiop-utils-lib/package.json ./packages/fspiop-utils-lib/
COPY packages/fspiop-api-svc/package.json ./packages/fspiop-api-svc/

#RUN ls -la

# If you are building your code for production
#RUN npm ci --only=production
RUN npm install

########################################
# Copy code and build

# root tsconfig.json
COPY tsconfig.json ./

# copy required supporting modules/packages (only the private ones not published to npm)
COPY packages/fspiop-utils-lib ./packages/fspiop-utils-lib

# copy service code
COPY packages/fspiop-api-svc ./packages/fspiop-api-svc


#RUN ls -la

# build
RUN npm run build

########################################
FROM node:16.13-alpine
WORKDIR /app

COPY --from=builder /app .

# kafka handler, no http server yet
EXPOSE 3010

CMD [ "npm", "run", "start:participants-svc" ]
