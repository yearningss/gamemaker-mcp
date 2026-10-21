/// @description MCP Commands - Audio Extended (Emitters, Listener, Track Position, Audio Groups)

function mcp_register_commands_audio_extended() {

    // Initialize emitter tracking
    if (!variable_global_exists("__mcp_tracked_emitters")) {
        global.__mcp_tracked_emitters = {};
        global.__mcp_tracked_emitter_next_id = 1;
    }

    mcp_route("create_audio_emitter", function(_params) {
        if (!variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: x, y", __code: -32602 };
        }

        var _x = _params.x;
        var _y = _params.y;
        var _e = audio_emitter_create();
        audio_emitter_position(_e, _x, _y, 0);

        // Optional falloff configuration
        if (variable_struct_exists(_params, "falloff_ref") &&
            variable_struct_exists(_params, "falloff_max") &&
            variable_struct_exists(_params, "falloff_factor")) {
            audio_falloff_set_model(audio_falloff_linear_distance);
            audio_emitter_falloff(_e, _params.falloff_ref, _params.falloff_max, _params.falloff_factor);
        }

        // Track the emitter
        var _id = global.__mcp_tracked_emitter_next_id;
        global.__mcp_tracked_emitter_next_id++;
        global.__mcp_tracked_emitters[$ string(_id)] = {
            emitter: _e,
            id: _id,
            x: _x,
            y: _y
        };

        return {
            emitter_id: _id,
            x: _x,
            y: _y,
            success: true
        };
    });

    mcp_route("set_emitter_position", function(_params) {
        if (!variable_struct_exists(_params, "emitter_id") ||
            !variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: emitter_id, x, y", __code: -32602 };
        }

        var _id = string(_params.emitter_id);
        if (!variable_struct_exists(global.__mcp_tracked_emitters, _id)) {
            return { __error: "Emitter not found: " + _id, __code: -32602 };
        }

        var _entry = global.__mcp_tracked_emitters[$ _id];
        var _e = _entry.emitter;
        var _x = _params.x;
        var _y = _params.y;
        audio_emitter_position(_e, _x, _y, 0);

        _entry.x = _x;
        _entry.y = _y;

        return {
            emitter_id: _params.emitter_id,
            x: _x,
            y: _y,
            success: true
        };
    });

    mcp_route("set_emitter_gain", function(_params) {
        if (!variable_struct_exists(_params, "emitter_id") ||
            !variable_struct_exists(_params, "gain")) {
            return { __error: "Missing required parameters: emitter_id, gain", __code: -32602 };
        }

        var _id = string(_params.emitter_id);
        if (!variable_struct_exists(global.__mcp_tracked_emitters, _id)) {
            return { __error: "Emitter not found: " + _id, __code: -32602 };
        }

        var _entry = global.__mcp_tracked_emitters[$ _id];
        var _e = _entry.emitter;
        var _gain = _params.gain;
        audio_emitter_gain(_e, _gain);

        return {
            emitter_id: _params.emitter_id,
            gain: _gain,
            success: true
        };
    });

    mcp_route("play_sound_on_emitter", function(_params) {
        if (!variable_struct_exists(_params, "emitter_id") ||
            !variable_struct_exists(_params, "sound_name")) {
            return { __error: "Missing required parameters: emitter_id, sound_name", __code: -32602 };
        }

        var _id = string(_params.emitter_id);
        if (!variable_struct_exists(global.__mcp_tracked_emitters, _id)) {
            return { __error: "Emitter not found: " + _id, __code: -32602 };
        }

        var _snd = asset_get_index(_params.sound_name);
        if (_snd < 0) {
            return { __error: "Sound not found: " + _params.sound_name, __code: -32602 };
        }

        var _entry = global.__mcp_tracked_emitters[$ _id];
        var _e = _entry.emitter;
        var _loop = variable_struct_exists(_params, "loop") ? _params.loop : false;
        var _priority = variable_struct_exists(_params, "priority") ? _params.priority : 1;

        var _inst = audio_play_sound_on(_e, _snd, _loop, _priority);

        return {
            emitter_id: _params.emitter_id,
            sound_name: _params.sound_name,
            sound_instance: _inst,
            success: true
        };
    });

    mcp_route("free_audio_emitter", function(_params) {
        if (!variable_struct_exists(_params, "emitter_id")) {
            return { __error: "Missing required parameter: emitter_id", __code: -32602 };
        }

        var _id = string(_params.emitter_id);
        if (!variable_struct_exists(global.__mcp_tracked_emitters, _id)) {
            return { __error: "Emitter not found: " + _id, __code: -32602 };
        }

        var _entry = global.__mcp_tracked_emitters[$ _id];
        var _e = _entry.emitter;
        audio_emitter_free(_e);
        variable_struct_remove(global.__mcp_tracked_emitters, _id);

        return {
            emitter_id: _params.emitter_id,
            freed: true
        };
    });

    mcp_route("get_emitter_list", function(_params) {
        var _list = [];
        var _keys = variable_struct_get_names(global.__mcp_tracked_emitters);
        for (var _i = 0; _i < array_length(_keys); _i++) {
            var _entry = global.__mcp_tracked_emitters[$ _keys[_i]];
            array_push(_list, {
                emitter_id: _entry.id,
                x: _entry.x,
                y: _entry.y
            });
        }

        return {
            emitters: _list,
            count: array_length(_list)
        };
    });

    mcp_route("set_audio_listener", function(_params) {
        if (!variable_struct_exists(_params, "x") ||
            !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: x, y", __code: -32602 };
        }

        var _x = _params.x;
        var _y = _params.y;
        var _z = variable_struct_exists(_params, "z") ? _params.z : 0;
        audio_listener_set_position(0, _x, _y, _z);

        return {
            x: _x,
            y: _y,
            z: _z,
            success: true
        };
    });

    mcp_route("get_track_position", function(_params) {
        if (!variable_struct_exists(_params, "sound_instance")) {
            return { __error: "Missing required parameter: sound_instance", __code: -32602 };
        }

        var _pos = audio_sound_get_track_position(_params.sound_instance);

        return {
            sound_instance: _params.sound_instance,
            position: _pos
        };
    });

    mcp_route("set_track_position", function(_params) {
        if (!variable_struct_exists(_params, "sound_instance") ||
            !variable_struct_exists(_params, "position")) {
            return { __error: "Missing required parameters: sound_instance, position", __code: -32602 };
        }

        audio_sound_set_track_position(_params.sound_instance, _params.position);

        return {
            sound_instance: _params.sound_instance,
            position: _params.position,
            success: true
        };
    });

    mcp_route("load_audio_group", function(_params) {
        if (!variable_struct_exists(_params, "group_id")) {
            return { __error: "Missing required parameter: group_id", __code: -32602 };
        }

        audio_group_load(_params.group_id);

        return {
            group_id: _params.group_id,
            loaded: true
        };
    });

    mcp_route("unload_audio_group", function(_params) {
        if (!variable_struct_exists(_params, "group_id")) {
            return { __error: "Missing required parameter: group_id", __code: -32602 };
        }

        audio_group_unload(_params.group_id);

        return {
            group_id: _params.group_id,
            unloaded: true
        };
    });

}
