/// @description Initialize MCP Server
if (!MCP_ENABLED) {
    instance_destroy();
    exit;
}

// Make persistent so it survives room changes
persistent = true;

// Initialize the server
var _success = mcp_server_init();
if (!_success) {
    show_debug_message("[MCP] Server initialization failed - destroying");
    instance_destroy();
    exit;
}
