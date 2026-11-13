FROM denoland/deno:latest
WORKDIR /app
COPY . .
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "--unstable-kv", "main.ts"]
