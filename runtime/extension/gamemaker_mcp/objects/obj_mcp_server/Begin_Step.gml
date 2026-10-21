/// @description Apply buffered MCP input simulation (Begin Step)
/// Runs before all Step events, so keyboard_key_press() fires before
/// keyboard_check_pressed() is evaluated in any object's Step event.
if (!MCP_ENABLED) exit;

// Initialize timed keys list if needed
if (!variable_global_exists("__mcp_timed_keys")) {
    global.__mcp_timed_keys = [];
}

if (variable_global_exists("__mcp_input_pending")) {
    var _pending = global.__mcp_input_pending;

    // Absorb newly queued timed presses into the active list
    if (variable_struct_exists(_pending, "timed")) {
        for (var _i = 0; _i < array_length(_pending.timed); _i++) {
            array_push(global.__mcp_timed_keys, {
                keycode: _pending.timed[_i].keycode,
                frames_remaining: _pending.timed[_i].frames
            });
        }
    }

    // Apply regular presses and releases
    for (var _i = 0; _i < array_length(_pending.presses); _i++) {
        keyboard_key_press(_pending.presses[_i]);
    }
    for (var _i = 0; _i < array_length(_pending.releases); _i++) {
        keyboard_key_release(_pending.releases[_i]);
    }

    global.__mcp_input_pending = { presses: [], releases: [], timed: [] };
}

// Tick active timed keys — iterate backwards for safe deletion
var _i = array_length(global.__mcp_timed_keys) - 1;
while (_i >= 0) {
    var _tk = global.__mcp_timed_keys[_i];
    if (_tk.frames_remaining > 0) {
        keyboard_key_press(_tk.keycode);
        _tk.frames_remaining--;
    } else {
        keyboard_key_release(_tk.keycode);
        array_delete(global.__mcp_timed_keys, _i, 1);
    }
    _i--;
}
