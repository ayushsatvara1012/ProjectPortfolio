FROM grafana/alloy:latest

COPY config.alloy /etc/alloy/config.alloy

# Run as a worker: scrape + remote_write only. The HTTP server (12345) is just
# Alloy's own UI/health and is not exposed by the Render Background Worker.
CMD ["run", "/etc/alloy/config.alloy", \
     "--server.http.listen-addr=0.0.0.0:12345", \
     "--storage.path=/tmp/alloy"]
