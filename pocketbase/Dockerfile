FROM alpine:3.20
ARG PB_VERSION=0.39.6
ARG TARGETARCH
RUN apk add --no-cache ca-certificates wget unzip && wget -qO /tmp/pb.zip https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip && unzip /tmp/pb.zip -d /pb && rm /tmp/pb.zip
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
COPY catalog-artifacts /pb/catalog-artifacts
COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh
WORKDIR /pb
EXPOSE 8090
ENTRYPOINT ["/pb/entrypoint.sh"]
