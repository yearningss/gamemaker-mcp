/// @description MCP Commands - File System Tools

function mcp_register_commands_filesystem() {

    mcp_route("list_files", function(_params) {
        var _dir = _params[$ "directory"] ?? working_directory;
        var _pattern = _params[$ "pattern"] ?? "*";

        // Ensure directory ends with a path separator
        if (string_char_at(_dir, string_length(_dir)) != "\\") {
            if (string_char_at(_dir, string_length(_dir)) != "/") {
                _dir += "/";
            }
        }

        var _files = [];
        var _fname = file_find_first(_dir + _pattern, fa_none);
        while (_fname != "") {
            array_push(_files, _fname);
            _fname = file_find_next();
        }
        file_find_close();

        return {
            files: _files,
            directory: _dir,
            count: array_length(_files)
        };
    });

    mcp_route("read_text_file", function(_params) {
        if (!variable_struct_exists(_params, "filename")) {
            return { __error: "Missing required parameter: filename", __code: -32602 };
        }

        var _filename = _params.filename;
        if (!file_exists(_filename)) {
            return { __error: "File not found: " + _filename, __code: -32602 };
        }

        var _file = file_text_open_read(_filename);
        var _text = "";
        var _max_size = 65536; // 64KB limit
        while (!file_text_eof(_file)) {
            if (string_length(_text) > 0) {
                _text += "\n";
            }
            _text += file_text_readln(_file);
            if (string_length(_text) >= _max_size) {
                _text = string_copy(_text, 1, _max_size);
                break;
            }
        }
        file_text_close(_file);

        return {
            content: _text,
            filename: _filename,
            size: string_length(_text)
        };
    });

    mcp_route("write_text_file", function(_params) {
        if (!variable_struct_exists(_params, "filename")) {
            return { __error: "Missing required parameter: filename", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "content")) {
            return { __error: "Missing required parameter: content", __code: -32602 };
        }

        var _filename = _params.filename;
        var _content = _params.content;
        var _append = _params[$ "append"] ?? false;

        var _file;
        if (_append) {
            _file = file_text_open_append(_filename);
        } else {
            _file = file_text_open_write(_filename);
        }
        file_text_write_string(_file, _content);
        file_text_close(_file);

        return {
            filename: _filename,
            written: true,
            append: _append
        };
    });

    mcp_route("read_json_file", function(_params) {
        if (!variable_struct_exists(_params, "filename")) {
            return { __error: "Missing required parameter: filename", __code: -32602 };
        }

        var _filename = _params.filename;
        if (!file_exists(_filename)) {
            return { __error: "File not found: " + _filename, __code: -32602 };
        }

        var _file = file_text_open_read(_filename);
        var _text = "";
        while (!file_text_eof(_file)) {
            if (string_length(_text) > 0) {
                _text += "\n";
            }
            _text += file_text_readln(_file);
        }
        file_text_close(_file);

        var _data;
        try {
            _data = json_parse(_text);
        } catch (_err) {
            return { __error: "Failed to parse JSON: " + string(_err), __code: -32603 };
        }

        return {
            data: _data,
            filename: _filename
        };
    });

    mcp_route("file_exists_check", function(_params) {
        if (!variable_struct_exists(_params, "filename")) {
            return { __error: "Missing required parameter: filename", __code: -32602 };
        }

        return {
            exists: file_exists(_params.filename),
            filename: _params.filename
        };
    });

    mcp_route("get_save_directory", function(_params) {
        return {
            save_directory: game_save_id,
            working_directory: working_directory,
            program_directory: program_directory
        };
    });

}
