/// @description MCP Commands - Input Simulation

/// @function __mcp_key_string_to_keycode(key_str)
/// @description Convert a key name string to a GameMaker keycode
/// @param {string} _key_str Key name (e.g. "vk_left", "ord_a", "vk_space")
/// @returns {real} GameMaker keycode, or -1 if not recognized
function __mcp_key_string_to_keycode(_key_str) {
    // Virtual key constants
    switch (_key_str) {
        case "vk_left":      return vk_left;
        case "vk_right":     return vk_right;
        case "vk_up":        return vk_up;
        case "vk_down":      return vk_down;
        case "vk_space":     return vk_space;
        case "vk_enter":     return vk_enter;
        case "vk_return":    return vk_enter;
        case "vk_escape":    return vk_escape;
        case "vk_shift":     return vk_shift;
        case "vk_control":   return vk_control;
        case "vk_alt":       return vk_alt;
        case "vk_tab":       return vk_tab;
        case "vk_backspace": return vk_backspace;
        case "vk_delete":    return vk_delete;
        case "vk_insert":    return vk_insert;
        case "vk_home":      return vk_home;
        case "vk_end":       return vk_end;
        case "vk_pageup":    return vk_pageup;
        case "vk_pagedown":  return vk_pagedown;
        case "vk_f1":        return vk_f1;
        case "vk_f2":        return vk_f2;
        case "vk_f3":        return vk_f3;
        case "vk_f4":        return vk_f4;
        case "vk_f5":        return vk_f5;
        case "vk_f6":        return vk_f6;
        case "vk_f7":        return vk_f7;
        case "vk_f8":        return vk_f8;
        case "vk_f9":        return vk_f9;
        case "vk_f10":       return vk_f10;
        case "vk_f11":       return vk_f11;
        case "vk_f12":       return vk_f12;
    }

    // ord_X format (e.g. "ord_a" -> ord("A"))
    if (string_pos("ord_", _key_str) == 1 && string_length(_key_str) == 5) {
        var _char = string_upper(string_char_at(_key_str, 5));
        return ord(_char);
    }

    // Raw numeric keycode
    if (string_digits(_key_str) == _key_str && string_length(_key_str) > 0) {
        return real(_key_str);
    }

    return -1;
}

function mcp_register_commands_input() {

    mcp_route("simulate_key_press", function(_params) {
        if (!variable_struct_exists(_params, "key")) {
            return { __error: "Missing required parameter: key", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_input_sim")) {
            global.__mcp_input_sim = {
                keys_pressed: {},
                mouse_buttons: {},
                mouse_x: 0,
                mouse_y: 0,
                mouse_wheel: 0,
                gamepad: {}
            };
        }

        var _key_str = string(_params.key);
        var _keycode = __mcp_key_string_to_keycode(_key_str);
        if (_keycode < 0) {
            return { __error: "Unrecognized key: " + _key_str, __code: -32602 };
        }

        variable_struct_set(global.__mcp_input_sim.keys_pressed, _key_str, true);

        // Buffer to be applied in Begin Step (before all Step events)
        if (!variable_global_exists("__mcp_input_pending")) {
            global.__mcp_input_pending = { presses: [], releases: [], timed: [] };
        }
        if (!variable_struct_exists(global.__mcp_input_pending, "timed")) {
            global.__mcp_input_pending.timed = [];
        }

        var _frames = variable_struct_exists(_params, "frames") ? _params.frames : -1;
        if (_frames > 0) {
            array_push(global.__mcp_input_pending.timed, { keycode: _keycode, frames: _frames });
        } else {
            array_push(global.__mcp_input_pending.presses, _keycode);
        }

        var _focused = window_has_focus();
        var _result = { success: true, key: _params.key, keycode: _keycode, state: "pressed", window_focused: _focused };
        if (_frames > 0) _result.frames = _frames;
        if (!_focused) _result.warning = "Game window does not have focus — GML clears keyboard state every frame when unfocused. Click the game window first.";
        return _result;
    });

    mcp_route("simulate_key_release", function(_params) {
        if (!variable_struct_exists(_params, "key")) {
            return { __error: "Missing required parameter: key", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_input_sim")) {
            return { __error: "Input simulation not initialized", __code: -32602 };
        }

        var _key_str = string(_params.key);
        var _keycode = __mcp_key_string_to_keycode(_key_str);

        if (variable_struct_exists(global.__mcp_input_sim.keys_pressed, _key_str)) {
            variable_struct_remove(global.__mcp_input_sim.keys_pressed, _key_str);
        }

        // Buffer the key release to be applied in the Step event
        if (_keycode >= 0) {
            if (!variable_global_exists("__mcp_input_pending")) {
                global.__mcp_input_pending = { presses: [], releases: [] };
            }
            array_push(global.__mcp_input_pending.releases, _keycode);
        }

        return { success: true, key: _params.key, keycode: _keycode, state: "released" };
    });

    mcp_route("simulate_mouse_move", function(_params) {
        if (!variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: x, y", __code: -32602 };
        }

        window_mouse_set(_params.x, _params.y);

        if (variable_global_exists("__mcp_input_sim")) {
            global.__mcp_input_sim.mouse_x = _params.x;
            global.__mcp_input_sim.mouse_y = _params.y;
        }

        return { success: true, x: _params.x, y: _params.y };
    });

    mcp_route("simulate_mouse_click", function(_params) {
        if (!variable_struct_exists(_params, "button")) {
            return { __error: "Missing required parameter: button (mb_left, mb_right, mb_middle)", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_input_sim")) {
            global.__mcp_input_sim = {
                keys_pressed: {},
                mouse_buttons: {},
                mouse_x: 0,
                mouse_y: 0,
                mouse_wheel: 0,
                gamepad: {}
            };
        }

        var _x = variable_struct_exists(_params, "x") ? _params.x : global.__mcp_input_sim.mouse_x;
        var _y = variable_struct_exists(_params, "y") ? _params.y : global.__mcp_input_sim.mouse_y;

        if (variable_struct_exists(_params, "x") && variable_struct_exists(_params, "y")) {
            window_mouse_set(_x, _y);
            global.__mcp_input_sim.mouse_x = _x;
            global.__mcp_input_sim.mouse_y = _y;
        }

        variable_struct_set(global.__mcp_input_sim.mouse_buttons, string(_params.button), true);

        return { success: true, button: _params.button, x: _x, y: _y, state: "clicked" };
    });

    mcp_route("simulate_mouse_wheel", function(_params) {
        if (!variable_struct_exists(_params, "direction")) {
            return { __error: "Missing required parameter: direction (1 for up, -1 for down)", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_input_sim")) {
            global.__mcp_input_sim = {
                keys_pressed: {},
                mouse_buttons: {},
                mouse_x: 0,
                mouse_y: 0,
                mouse_wheel: 0,
                gamepad: {}
            };
        }

        global.__mcp_input_sim.mouse_wheel = _params.direction;
        return { success: true, direction: _params.direction };
    });

    mcp_route("simulate_gamepad", function(_params) {
        // Bridge sends pad_index/button/axis_h/axis_v; accept both bridge and legacy formats
        if (!variable_global_exists("__mcp_input_sim")) {
            global.__mcp_input_sim = {
                keys_pressed: {},
                mouse_buttons: {},
                mouse_x: 0,
                mouse_y: 0,
                mouse_wheel: 0,
                gamepad: {}
            };
        }

        // Accept pad_index (bridge) or gamepad_index (legacy)
        var _pad = 0;
        if (variable_struct_exists(_params, "pad_index")) _pad = _params.pad_index;
        else if (variable_struct_exists(_params, "gamepad_index")) _pad = _params.gamepad_index;
        var _pad_key = string(_pad);

        if (!variable_struct_exists(global.__mcp_input_sim.gamepad, _pad_key)) {
            variable_struct_set(global.__mcp_input_sim.gamepad, _pad_key, {});
        }
        var _pad_state = variable_struct_get(global.__mcp_input_sim.gamepad, _pad_key);

        // Accept button (bridge) or input/value (legacy)
        if (variable_struct_exists(_params, "button")) {
            variable_struct_set(_pad_state, string(_params.button), 1);
        }
        if (variable_struct_exists(_params, "axis_h")) {
            variable_struct_set(_pad_state, "axis_h", _params.axis_h);
        }
        if (variable_struct_exists(_params, "axis_v")) {
            variable_struct_set(_pad_state, "axis_v", _params.axis_v);
        }
        if (variable_struct_exists(_params, "input") && variable_struct_exists(_params, "value")) {
            variable_struct_set(_pad_state, string(_params.input), _params.value);
        }

        return {
            success: true,
            gamepad_index: _pad,
            params: _params
        };
    });

    mcp_route("simulate_input_sequence", function(_params) {
        if (!variable_struct_exists(_params, "actions") ||
            !is_array(_params.actions)) {
            return { __error: "Missing required parameter: actions (array of {type, params, delay_frames})", __code: -32602 };
        }

        if (!variable_global_exists("__mcp_input_sequence")) {
            global.__mcp_input_sequence = [];
        }

        var _seq_id = current_time;
        var _sequence = {
            id: _seq_id,
            actions: _params.actions,
            current_index: 0,
            frame_counter: 0,
            active: true
        };

        array_push(global.__mcp_input_sequence, _sequence);

        return {
            success: true,
            sequence_id: _seq_id,
            action_count: array_length(_params.actions),
            note: "Sequence queued for frame-by-frame execution"
        };
    });

}
