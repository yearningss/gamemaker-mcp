/// @description MCP Commands - Performance Profiling

function mcp_register_commands_profiling() {

    mcp_route("get_performance_stats", function(_params) {
        return {
            fps: fps,
            fps_real: fps_real,
            instance_count: instance_count,
            delta_time: delta_time,
            application_surface_width: surface_get_width(application_surface),
            application_surface_height: surface_get_height(application_surface),
            game_speed: game_get_speed(gamespeed_fps),
            current_time: current_time,
            texture_pages_used: -1,
            note_texture: "Use get_texture_page_info for texture details."
        };
    });

    mcp_route("start_profiling", function(_params) {
        // Bridge sends "duration_frames", accept both
        var _duration = 300;
        if (variable_struct_exists(_params, "duration_frames")) _duration = _params.duration_frames;
        else if (variable_struct_exists(_params, "duration")) _duration = _params.duration;

        global.__mcp_profiling = true;
        global.__mcp_profiling_data = {
            start_time: current_time,
            duration: _duration,
            frames_collected: 0,
            fps_samples: [],
            fps_real_samples: [],
            instance_count_samples: [],
            delta_time_samples: [],
            min_fps: 999999,
            max_fps: 0,
            total_fps: 0,
            min_fps_real: 999999,
            max_fps_real: 0,
            total_fps_real: 0,
            total_instance_count: 0
        };

        return {
            profiling: true,
            duration: _duration,
            note: "Profiling started. Collect data each frame using get_profiling_report or by checking global.__mcp_profiling in your Step event."
        };
    });

    mcp_route("stop_profiling", function(_params) {
        if (!variable_global_exists("__mcp_profiling") || !global.__mcp_profiling) {
            return { __error: "Profiling is not currently active.", __code: -32602 };
        }

        global.__mcp_profiling = false;

        var _data = global.__mcp_profiling_data;
        var _frames = _data.frames_collected;

        var _result = {
            profiling: false,
            elapsed_time_ms: current_time - _data.start_time,
            frames_collected: _frames
        };

        if (_frames > 0) {
            _result.avg_fps = _data.total_fps / _frames;
            _result.min_fps = _data.min_fps;
            _result.max_fps = _data.max_fps;
            _result.avg_fps_real = _data.total_fps_real / _frames;
            _result.min_fps_real = _data.min_fps_real;
            _result.max_fps_real = _data.max_fps_real;
            _result.avg_instance_count = _data.total_instance_count / _frames;
        }

        return _result;
    });

    mcp_route("get_profiling_report", function(_params) {
        if (!variable_global_exists("__mcp_profiling_data")) {
            return { __error: "No profiling data available. Use start_profiling first.", __code: -32602 };
        }

        var _data = global.__mcp_profiling_data;
        var _frames = _data.frames_collected;

        // If profiling is active, record the current frame
        if (variable_global_exists("__mcp_profiling") && global.__mcp_profiling) {
            _data.frames_collected++;
            _data.total_fps += fps;
            _data.total_fps_real += fps_real;
            _data.total_instance_count += instance_count;

            if (fps < _data.min_fps) _data.min_fps = fps;
            if (fps > _data.max_fps) _data.max_fps = fps;
            if (fps_real < _data.min_fps_real) _data.min_fps_real = fps_real;
            if (fps_real > _data.max_fps_real) _data.max_fps_real = fps_real;

            // Store samples (limit to avoid memory issues)
            if (array_length(_data.fps_samples) < 600) {
                array_push(_data.fps_samples, fps);
                array_push(_data.fps_real_samples, fps_real);
                array_push(_data.instance_count_samples, instance_count);
                array_push(_data.delta_time_samples, delta_time);
            }

            _frames = _data.frames_collected;
        }

        var _report = {
            active: variable_global_exists("__mcp_profiling") ? global.__mcp_profiling : false,
            elapsed_time_ms: current_time - _data.start_time,
            frames_collected: _frames,
            current_fps: fps,
            current_fps_real: fps_real,
            current_instance_count: instance_count
        };

        if (_frames > 0) {
            _report.avg_fps = _data.total_fps / _frames;
            _report.min_fps = _data.min_fps;
            _report.max_fps = _data.max_fps;
            _report.avg_fps_real = _data.total_fps_real / _frames;
            _report.min_fps_real = _data.min_fps_real;
            _report.max_fps_real = _data.max_fps_real;
            _report.avg_instance_count = _data.total_instance_count / _frames;
        }

        return _report;
    });

    mcp_route("get_texture_page_info", function(_params) {
        // GameMaker has limited runtime texture introspection.
        // We can report on specific sprites or the application surface.
        var _result = {
            application_surface_width: surface_get_width(application_surface),
            application_surface_height: surface_get_height(application_surface)
        };

        // If a sprite name is provided, get its texture page info
        if (variable_struct_exists(_params, "sprite_name")) {
            var _spr = asset_get_index(_params.sprite_name);
            if (_spr >= 0) {
                var _tex = sprite_get_uvs(_spr, 0);
                _result.sprite_name = _params.sprite_name;
                _result.sprite_uvs = {
                    left: _tex[0],
                    top: _tex[1],
                    right: _tex[2],
                    bottom: _tex[3],
                    trimmed_x: _tex[4],
                    trimmed_y: _tex[5],
                    source_width: _tex[6],
                    source_height: _tex[7]
                };
                var _tex_id = sprite_get_texture(_spr, 0);
                _result.texture_id = _tex_id;
                _result.texture_width = texture_get_width(_tex_id);
                _result.texture_height = texture_get_height(_tex_id);
            } else {
                _result.sprite_error = "Sprite not found: " + _params.sprite_name;
            }
        }

        _result.note = "GameMaker does not provide a runtime function to list all texture pages. Query specific sprites for their texture info.";

        return _result;
    });
}
