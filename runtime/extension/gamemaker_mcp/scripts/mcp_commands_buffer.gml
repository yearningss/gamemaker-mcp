/// @description MCP Commands - Buffer Tools

function mcp_register_commands_buffer() {

    // Initialize tracking globals if not already set
    if (!variable_global_exists("__mcp_tracked_buffers")) {
        global.__mcp_tracked_buffers = {};
        global.__mcp_tracked_buffer_next_id = 1;
    }

    mcp_route("create_buffer", function(_params) {
        if (!variable_struct_exists(_params, "size") || !variable_struct_exists(_params, "type")) {
            return { __error: "Missing required parameters: size, type", __code: -32602 };
        }

        var _size = _params.size;
        var _kind = __mcp_buffer_kind_from_string(_params.type);
        var _align = variable_struct_exists(_params, "alignment") ? _params.alignment : 1;

        var _buf = buffer_create(_size, _kind, _align);
        var _track_id = global.__mcp_tracked_buffer_next_id++;

        variable_struct_set(global.__mcp_tracked_buffers, string(_track_id), {
            buffer: _buf,
            type_name: _params.type
        });

        return {
            buffer_id: _track_id,
            size: _size,
            type: _params.type,
            alignment: _align,
            success: true
        };
    });

    mcp_route("write_buffer", function(_params) {
        if (!variable_struct_exists(_params, "buffer_id") || !variable_struct_exists(_params, "data_type") || !variable_struct_exists(_params, "value")) {
            return { __error: "Missing required parameters: buffer_id, data_type, value", __code: -32602 };
        }

        var _id = string(_params.buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _id)) {
            return { __error: "Buffer not found: " + _id, __code: -32602 };
        }

        var _entry = variable_struct_get(global.__mcp_tracked_buffers, _id);
        var _buf = _entry.buffer;
        var _dtype = __mcp_buffer_type_from_string(_params.data_type);

        if (_dtype == -1) {
            return { __error: "Unknown data type: " + _params.data_type, __code: -32602 };
        }

        buffer_write(_buf, _dtype, _params.value);

        return {
            buffer_id: _params.buffer_id,
            data_type: _params.data_type,
            value: _params.value,
            position: buffer_tell(_buf),
            success: true
        };
    });

    mcp_route("read_buffer", function(_params) {
        if (!variable_struct_exists(_params, "buffer_id") || !variable_struct_exists(_params, "data_type")) {
            return { __error: "Missing required parameters: buffer_id, data_type", __code: -32602 };
        }

        var _id = string(_params.buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _id)) {
            return { __error: "Buffer not found: " + _id, __code: -32602 };
        }

        var _entry = variable_struct_get(global.__mcp_tracked_buffers, _id);
        var _buf = _entry.buffer;
        var _dtype = __mcp_buffer_type_from_string(_params.data_type);

        if (_dtype == -1) {
            return { __error: "Unknown data type: " + _params.data_type, __code: -32602 };
        }

        var _value = buffer_read(_buf, _dtype);

        return {
            buffer_id: _params.buffer_id,
            data_type: _params.data_type,
            value: _value,
            position: buffer_tell(_buf)
        };
    });

    mcp_route("dump_buffer_hex", function(_params) {
        if (!variable_struct_exists(_params, "buffer_id")) {
            return { __error: "Missing required parameter: buffer_id", __code: -32602 };
        }

        var _id = string(_params.buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _id)) {
            return { __error: "Buffer not found: " + _id, __code: -32602 };
        }

        var _entry = variable_struct_get(global.__mcp_tracked_buffers, _id);
        var _buf = _entry.buffer;
        var _buf_size = buffer_get_size(_buf);
        var _offset = variable_struct_exists(_params, "offset") ? _params.offset : 0;
        var _length = variable_struct_exists(_params, "length") ? _params.length : 256;

        _length = min(_length, _buf_size - _offset);
        if (_length <= 0) {
            return {
                buffer_id: _params.buffer_id,
                hex: "",
                offset: _offset,
                length: 0
            };
        }

        var _hex = "";
        for (var _i = 0; _i < _length; _i++) {
            var _byte = buffer_peek(_buf, _offset + _i, buffer_u8);
            var _hi = _byte >> 4;
            var _lo = _byte & 0x0F;
            _hex += __mcp_hex_char(_hi) + __mcp_hex_char(_lo);
            if (_i < _length - 1) {
                _hex += " ";
            }
        }

        return {
            buffer_id: _params.buffer_id,
            hex: _hex,
            offset: _offset,
            length: _length
        };
    });

    mcp_route("get_buffer_info", function(_params) {
        if (!variable_struct_exists(_params, "buffer_id")) {
            return { __error: "Missing required parameter: buffer_id", __code: -32602 };
        }

        var _id = string(_params.buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _id)) {
            return { __error: "Buffer not found: " + _id, __code: -32602 };
        }

        var _entry = variable_struct_get(global.__mcp_tracked_buffers, _id);
        var _buf = _entry.buffer;

        return {
            buffer_id: _params.buffer_id,
            size: buffer_get_size(_buf),
            position: buffer_tell(_buf),
            type: _entry.type_name
        };
    });

    mcp_route("delete_buffer", function(_params) {
        if (!variable_struct_exists(_params, "buffer_id")) {
            return { __error: "Missing required parameter: buffer_id", __code: -32602 };
        }

        var _id = string(_params.buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _id)) {
            return { __error: "Buffer not found: " + _id, __code: -32602 };
        }

        var _entry = variable_struct_get(global.__mcp_tracked_buffers, _id);
        buffer_delete(_entry.buffer);
        variable_struct_remove(global.__mcp_tracked_buffers, _id);

        return {
            buffer_id: _params.buffer_id,
            deleted: true
        };
    });

    mcp_route("list_buffers", function(_params) {
        var _keys = variable_struct_get_names(global.__mcp_tracked_buffers);
        var _buffers = [];

        for (var _i = 0; _i < array_length(_keys); _i++) {
            var _key = _keys[_i];
            var _entry = variable_struct_get(global.__mcp_tracked_buffers, _key);
            var _buf = _entry.buffer;
            array_push(_buffers, {
                id: real(_key),
                size: buffer_get_size(_buf),
                position: buffer_tell(_buf),
                type: _entry.type_name
            });
        }

        return {
            buffers: _buffers,
            count: array_length(_buffers)
        };
    });

    mcp_route("buffer_to_base64", function(_params) {
        if (!variable_struct_exists(_params, "buffer_id")) {
            return { __error: "Missing required parameter: buffer_id", __code: -32602 };
        }

        var _id = string(_params.buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _id)) {
            return { __error: "Buffer not found: " + _id, __code: -32602 };
        }

        var _entry = variable_struct_get(global.__mcp_tracked_buffers, _id);
        var _buf = _entry.buffer;
        var _encoded = buffer_base64_encode(_buf, 0, buffer_get_size(_buf));

        return {
            buffer_id: _params.buffer_id,
            base64: _encoded
        };
    });

    mcp_route("buffer_from_base64", function(_params) {
        if (!variable_struct_exists(_params, "base64")) {
            return { __error: "Missing required parameter: base64", __code: -32602 };
        }

        var _b64 = _params.base64;
        var _type_str = variable_struct_exists(_params, "type") ? _params.type : "grow";
        var _kind = __mcp_buffer_kind_from_string(_type_str);

        var _buf = buffer_base64_decode(_b64);
        var _new_size = buffer_get_size(_buf);
        var _track_id = global.__mcp_tracked_buffer_next_id++;

        variable_struct_set(global.__mcp_tracked_buffers, string(_track_id), {
            buffer: _buf,
            type_name: _type_str
        });

        return {
            buffer_id: _track_id,
            size: _new_size,
            success: true
        };
    });

    mcp_route("copy_buffer", function(_params) {
        if (!variable_struct_exists(_params, "src_buffer_id")) {
            return { __error: "Missing required parameter: src_buffer_id", __code: -32602 };
        }

        var _src_id = string(_params.src_buffer_id);
        if (!variable_struct_exists(global.__mcp_tracked_buffers, _src_id)) {
            return { __error: "Source buffer not found: " + _src_id, __code: -32602 };
        }

        var _src_entry = variable_struct_get(global.__mcp_tracked_buffers, _src_id);
        var _src_buf = _src_entry.buffer;
        var _src_size = buffer_get_size(_src_buf);

        var _src_offset = variable_struct_exists(_params, "src_offset") ? _params.src_offset : 0;
        var _length = variable_struct_exists(_params, "length") ? _params.length : (_src_size - _src_offset);

        var _dest_buf;
        var _dest_track_id;
        var _created_new = false;

        if (variable_struct_exists(_params, "dest_buffer_id")) {
            var _dest_id = string(_params.dest_buffer_id);
            if (!variable_struct_exists(global.__mcp_tracked_buffers, _dest_id)) {
                return { __error: "Destination buffer not found: " + _dest_id, __code: -32602 };
            }
            var _dest_entry = variable_struct_get(global.__mcp_tracked_buffers, _dest_id);
            _dest_buf = _dest_entry.buffer;
            _dest_track_id = _params.dest_buffer_id;
        } else {
            _dest_buf = buffer_create(_length, buffer_grow, 1);
            _dest_track_id = global.__mcp_tracked_buffer_next_id++;
            variable_struct_set(global.__mcp_tracked_buffers, string(_dest_track_id), {
                buffer: _dest_buf,
                type_name: "grow"
            });
            _created_new = true;
        }

        buffer_copy(_src_buf, _src_offset, _length, _dest_buf, 0);

        return {
            src_buffer_id: _params.src_buffer_id,
            dest_buffer_id: _dest_track_id,
            bytes_copied: _length,
            created_new_buffer: _created_new,
            success: true
        };
    });
}

/// @description Convert a nibble (0-15) to a hex character
function __mcp_hex_char(_nibble) {
    if (_nibble < 10) {
        return chr(ord("0") + _nibble);
    } else {
        return chr(ord("A") + (_nibble - 10));
    }
}

/// @description Map data type string to buffer type constant
function __mcp_buffer_type_from_string(_type_str) {
    switch (_type_str) {
        case "u8": return buffer_u8;
        case "s8": return buffer_s8;
        case "u16": return buffer_u16;
        case "s16": return buffer_s16;
        case "u32": return buffer_u32;
        case "s32": return buffer_s32;
        case "f32": return buffer_f32;
        case "f64": return buffer_f64;
        case "string": return buffer_string;
        case "bool": return buffer_bool;
        case "text": return buffer_text;
        default: return -1;
    }
}

/// @description Map buffer kind string to buffer kind constant
function __mcp_buffer_kind_from_string(_kind_str) {
    switch (_kind_str) {
        case "fixed": return buffer_fixed;
        case "grow": return buffer_grow;
        case "wrap": return buffer_wrap;
        case "fast": return buffer_fast;
        default: return buffer_grow;
    }
}
