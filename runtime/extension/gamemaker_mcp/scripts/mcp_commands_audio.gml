/// @description MCP Commands - Audio Control

function mcp_register_commands_audio() {

    mcp_route("get_playing_sounds", function(_params) {
        var _playing = [];

        // Check known sound assets for playing status
        // Since GML doesn't provide a way to iterate all sound assets,
        // we check sounds that have been tracked
        if (variable_global_exists("__mcp_known_sounds")) {
            var _sounds = global.__mcp_known_sounds;
            for (var _i = 0; _i < array_length(_sounds); _i++) {
                var _snd = _sounds[_i];
                if (audio_is_playing(_snd)) {
                    array_push(_playing, {
                        sound_index: _snd,
                        sound_name: audio_get_name(_snd),
                        is_playing: true
                    });
                }
            }
        }

        return {
            playing: _playing,
            count: array_length(_playing),
            note: "Only tracks sounds played through MCP or registered via __mcp_known_sounds"
        };
    });

    mcp_route("play_sound", function(_params) {
        if (!variable_struct_exists(_params, "sound_name")) {
            return { __error: "Missing required parameter: sound_name", __code: -32602 };
        }

        var _snd = asset_get_index(_params.sound_name);
        if (_snd < 0) {
            return { __error: "Sound not found: " + _params.sound_name, __code: -32602 };
        }

        var _priority = variable_struct_exists(_params, "priority") ? _params.priority : 1;
        var _loop = variable_struct_exists(_params, "loop") ? _params.loop : false;
        var _gain = variable_struct_exists(_params, "gain") ? _params.gain : 1.0;

        var _inst = audio_play_sound(_snd, _priority, _loop);

        if (_gain != 1.0) {
            audio_sound_gain(_inst, _gain, 0);
        }

        // Track the sound for get_playing_sounds
        if (!variable_global_exists("__mcp_known_sounds")) {
            global.__mcp_known_sounds = [];
        }
        // Add to known sounds if not already tracked
        var _found = false;
        for (var _i = 0; _i < array_length(global.__mcp_known_sounds); _i++) {
            if (global.__mcp_known_sounds[_i] == _snd) { _found = true; break; }
        }
        if (!_found) array_push(global.__mcp_known_sounds, _snd);

        return {
            success: true,
            sound_name: _params.sound_name,
            sound_instance: _inst,
            loop: _loop,
            gain: _gain
        };
    });

    mcp_route("stop_sound", function(_params) {
        if (!variable_struct_exists(_params, "sound_name")) {
            return { __error: "Missing required parameter: sound_name", __code: -32602 };
        }

        var _snd = asset_get_index(_params.sound_name);
        if (_snd < 0) {
            return { __error: "Sound not found: " + _params.sound_name, __code: -32602 };
        }

        audio_stop_sound(_snd);
        return { success: true, sound_name: _params.sound_name, state: "stopped" };
    });

    mcp_route("set_sound_volume", function(_params) {
        if (!variable_struct_exists(_params, "sound_name") ||
            !variable_struct_exists(_params, "volume")) {
            return { __error: "Missing required parameters: sound_name, volume", __code: -32602 };
        }

        var _snd = asset_get_index(_params.sound_name);
        if (_snd < 0) {
            return { __error: "Sound not found: " + _params.sound_name, __code: -32602 };
        }

        var _time = variable_struct_exists(_params, "fade_time") ? _params.fade_time : 0;
        audio_sound_gain(_snd, _params.volume, _time);

        return {
            success: true,
            sound_name: _params.sound_name,
            volume: _params.volume,
            fade_time: _time
        };
    });

    mcp_route("get_audio_info", function(_params) {
        return {
            listener_count: audio_get_listener_count()
        };
    });

    mcp_route("stop_all_sounds", function(_params) {
        audio_stop_all();
        return { success: true, note: "All audio stopped" };
    });

}
