# Use the official AWS Lambda adapter image to handle the Lambda runtime.
FROM public.ecr.aws/awsguru/aws-lambda-adapter:1.0.1 AS aws-lambda-adapter

# Use the official Bun image to run the application.
FROM oven/bun:debian AS bun_latest

# Copy the Lambda adapter into the container.
COPY --from=aws-lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

# Set the port to 8080. This is required for the AWS Lambda adapter.
ENV NODE_ENV=production
ENV PORT=8080
ENV TMPDIR=/tmp
ENV TMP=/tmp
ENV TEMP=/tmp
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp
ENV AWS_LWA_READINESS_CHECK_PATH=/health
ENV AWS_LWA_INVOKE_MODE=response_stream

# Set the work directory to `/var/task`. This is the default work directory for Lambda.
WORKDIR "/var/task"

# Copy the package.json and bun.lock into the container.
COPY package.json bun.lock ./

# Install production dependencies.
RUN bun install --production --frozen-lockfile

# Copy the rest of the application into the container.
COPY . /var/task

# Run the application.
CMD ["bun", "run", "start"]
