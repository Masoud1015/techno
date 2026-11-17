This is NOT a complete Nginx server config.
Use nginx-auth-snippet.conf only inside a properly secured HTTPS server block.
If there is a CDN/load balancer before Nginx, review real_ip_header and trusted proxy CIDRs first.
Protect PostgreSQL from public traffic and replace the development password before production.
