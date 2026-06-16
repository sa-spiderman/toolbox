/**
 * 实用在线工具箱 - 主逻辑
 */
(function () {
  "use strict";

  // ===============================================
  // MARKDOWN PARSER
  // ===============================================

  function renderMarkdown(md) {
    if (!md.trim()) return "<div class=\"placeholder-text\">输入 Markdown 后实时预览</div>";

    var html = md;

    // 1. 转义 HTML 特殊字符
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 2. 代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (m, lang, code) {
      return "<pre><code>" + code.trim() + "</code></pre>";
    });

    // 3. 行内代码
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // 4. 图片
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<img src=\"$2\" alt=\"$1\">");

    // 5. 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\">$1</a>");

    // 6. 加粗/斜体
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // 7. 分隔线
    html = html.replace(/^---+\s*$/gm, "<hr>");

    // 8. 标题
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // 9. 引用
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    // 10. 无序列表
    html = html.replace(/^[\*\-] (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, function (m) {
      return "<ul>" + m.replace(/\n/g, "") + "</ul>";
    });

    // 11. 有序列表
    html = html.replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>");

    // 12. 表格
    html = html.replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g, function (m, header, rows) {
      var cells = header.split("|").filter(Boolean);
      var thead = "<thead><tr>" + cells.map(function (c) { return "<th>" + c.trim() + "</th>"; }).join("") + "</tr></thead>";
      var trows = rows.trim().split("\n").map(function (row) {
        var rcells = row.split("|").filter(Boolean);
        return "<tr>" + rcells.map(function (c) { return "<td>" + c.trim() + "</td>"; }).join("") + "</tr>";
      }).join("");
      return "<table>" + thead + "<tbody>" + trows + "</tbody></table>";
    });

    // 13. 段落包裹
    var lines = html.split("\n");
    var result = [];
    var inParagraph = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var isBlock = /^<(\/?)(h[1-3]|ul|ol|li|blockquote|pre|hr|table|thead|tbody|tr|th|td|div|img)/.test(line);

      if (!line) {
        if (inParagraph) { result.push("</p>");
          inParagraph = false; }
        continue;
      }

      if (isBlock) {
        if (inParagraph) { result.push("</p>");
          inParagraph = false; }
        result.push(line);
      } else {
        if (!inParagraph) { result.push("<p>");
          inParagraph = true; }
        result.push(line);
      }
    }
    if (inParagraph) result.push("</p>");

    return result.join("\n");
  }


  // ===============================================
  // QR CODE GENERATOR
  // ===============================================

  var qrcode = (function () {
    var EC_LEVEL_MAP = { L: 0, M: 1, Q: 2, H: 3 };

    function QR8bitByte(data) {
      this.mode = 1 << 2;
      this.data = data;
    }
    QR8bitByte.prototype.getLength = function () { return this.data.length; };
    QR8bitByte.prototype.write = function (bitBuffer) {
      for (var i = 0; i < this.data.length; i++) {
        bitBuffer.put(this.data.charCodeAt(i), 8);
      }
    };

    function BitBuffer() { this.buffer = [];
      this.length = 0; }
    BitBuffer.prototype.put = function (num, length) {
      for (var i = 0; i < length; i++) {
        this.buffer.push(((num >> (length - i - 1)) & 1));
      }
      this.length += length;
    };
    BitBuffer.prototype.get = function (i) { return this.buffer[i]; };
    BitBuffer.prototype.getLengthInBits = function () { return this.length; };

    // GF(256)
    var gfExp = new Array(256);
    var gfLog = new Array(256);
    (function () {
      var val = 1;
      for (var i = 0; i < 255; i++) {
        gfExp[i] = val;
        gfLog[val] = i;
        val <<= 1;
        if (val >= 256) val ^= 0x11d;
      }
      gfExp[255] = gfExp[0];
      gfLog[0] = -1;
    })();

    function gfMul(x, y) {
      if (x === 0 || y === 0) return 0;
      return gfExp[(gfLog[x] + gfLog[y]) % 255];
    }

    function rsGenPoly(degree) {
      var poly = [1];
      for (var i = 0; i < degree; i++) {
        var mul = [1, gfExp[i]];
        var newPoly = new Array(poly.length + 1).fill(0);
        for (var j = 0; j < poly.length; j++) {
          newPoly[j] ^= poly[j];
          newPoly[j + 1] ^= gfMul(poly[j], mul[1]);
        }
        poly = newPoly;
      }
      return poly;
    }

    function rsMod(dividend, divisor) {
      var dlen = dividend.length;
      var dlen2 = divisor.length;
      var result = dividend.slice();
      for (var i = 0; i < dlen - dlen2 + 1; i++) {
        if (result[i] !== 0) {
          var coef = result[i];
          for (var j = 0; j < dlen2; j++) {
            result[i + j] ^= gfMul(divisor[j], coef);
          }
        }
      }
      return result.slice(dlen - dlen2 + 1);
    }

    // QR 版本表
    var VERSION_DATA = {
      1: { total: 26, data: [19, 16, 13, 9], blocks: [1, 1, 1, 1], ecPB: [7, 10, 13, 17] },
      2: { total: 44, data: [34, 28, 22, 16], blocks: [1, 1, 1, 1], ecPB: [10, 16, 22, 28] },
      3: { total: 70, data: [55, 44, 34, 26], blocks: [1, 1, 2, 2], ecPB: [15, 26, 18, 22] },
      4: { total: 100, data: [80, 64, 48, 36], blocks: [1, 2, 2, 4], ecPB: [20, 18, 26, 16] },
      5: { total: 134, data: [108, 86, 62, 46], blocks: [1, 2, 4, 4], ecPB: [26, 24, 18, 22] },
      6: { total: 172, data: [136, 108, 76, 60], blocks: [2, 4, 4, 6], ecPB: [18, 16, 24, 28] },
      7: { total: 196, data: [156, 124, 88, 66], blocks: [2, 4, 6, 6], ecPB: [20, 18, 18, 26] },
      8: { total: 242, data: [194, 154, 110, 86], blocks: [2, 4, 6, 8], ecPB: [24, 22, 22, 26] },
      9: { total: 292, data: [232, 182, 132, 100], blocks: [2, 5, 8, 8], ecPB: [30, 24, 20, 24] },
      10: { total: 346, data: [274, 216, 154, 122], blocks: [4, 5, 8, 8], ecPB: [18, 24, 24, 28] }
    };

    var ALIGN_POS = {
      1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
      6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
    };

    function selectVersion(dataLen, ecIdx) {
      var minBits = 4 + 8 + dataLen * 8 + 4;
      for (var v = 1; v <= 10; v++) {
        if (VERSION_DATA[v].data[ecIdx] * 8 >= minBits) return v;
      }
      return -1;
    }

    function makeMatrix(size) {
      var d = [];
      for (var i = 0; i < size; i++) { d[i] = new Array(size).fill(0); }
      return { size: size, data: d };
    }

    function addFinder(m) {
      var s = m.size;
      var pos = [[0, 0], [s - 7, 0], [0, s - 7]];
      for (var p = 0; p < pos.length; p++) {
        var ox = pos[p][0], oy = pos[p][1];
        for (var i = -1; i <= 7; i++) {
          for (var j = -1; j <= 7; j++) {
            var x = ox + j, y = oy + i;
            if (x < 0 || x >= s || y < 0 || y >= s) continue;
            if (i >= 0 && i <= 6 && j >= 0 && j <= 6) {
              if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4))
                m.data[y][x] = 1;
            }
          }
        }
      }
    }

    function addTiming(m) {
      var s = m.size;
      for (var i = 8; i < s - 8; i++) {
        m.data[6][i] = (i % 2 === 0) ? 1 : 0;
        m.data[i][6] = (i % 2 === 0) ? 1 : 0;
      }
    }

    function addAlignment(m, ver) {
      var pos = ALIGN_POS[ver];
      if (!pos) return;
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          if (i === 0 && j === 0) continue;
          var cy = pos[i], cx = pos[j];
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              var y2 = cy + r, x2 = cx + c;
              if (y2 < 0 || y2 >= m.size || x2 < 0 || x2 >= m.size) continue;
              if (m.data[y2][x2] !== 0) continue;
              m.data[y2][x2] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
            }
          }
        }
      }
    }

    function reserveFormat(m) {
      var s = m.size;
      for (var i = 0; i <= 8; i++) {
        if (m.data[8][i] === 0) m.data[8][i] = -1;
        if (m.data[i][8] === 0) m.data[i][8] = -1;
      }
      for (var i = s - 8; i < s; i++) {
        if (m.data[8][i] === 0) m.data[8][i] = -1;
        if (m.data[i][8] === 0) m.data[i][8] = -1;
      }
      m.data[s - 8][8] = 1;
    }

    function placeData(m, bits) {
      var s = m.size;
      var bi = 0, dir = -1, col = s - 1;
      while (col > 0) {
        if (col === 6) col = 5;
        for (var row = (dir === -1) ? s - 1 : 0; (dir === -1) ? row >= 0 : row < s; row += dir) {
          for (var cOff = 0; cOff < 2; cOff++) {
            var x = col - cOff;
            if (x < 0) continue;
            if (m.data[row][x] === 0) {
              m.data[row][x] = (bi < bits.length) ? bits[bi++] : 0;
            }
          }
        }
        dir = -dir;
        col -= 2;
      }
    }

    function applyMask(m, pat) {
      var s = m.size;
      for (var y = 0; y < s; y++) {
        for (var x = 0; x < s; x++) {
          if (m.data[y][x] === -1) continue;
          var flip = false;
          switch (pat) {
            case 0: flip = (y + x) % 2 === 0; break;
            case 1: flip = y % 2 === 0; break;
            case 2: flip = x % 3 === 0; break;
            case 3: flip = (y + x) % 3 === 0; break;
            case 4: flip = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; break;
            case 5: flip = ((y * x) % 2) + ((y * x) % 3) === 0; break;
            case 6: flip = (((y * x) % 2) + ((y * x) % 3)) % 2 === 0; break;
            case 7: flip = (((y + x) % 2) + ((y * x) % 3)) % 2 === 0; break;
          }
          if (flip) m.data[y][x] ^= 1;
        }
      }
    }

    function makeFormatBits(ecIdx, maskPat) {
      var data = (ecIdx << 3) | maskPat;
      var poly = data << 10;
      var gen = 0b10100110111;
      for (var i = 14; i >= 10; i--) {
        if ((poly >> i) & 1) poly ^= gen << (i - 10);
      }
      var fmt = ((data << 10) | poly) ^ 0b101010000010010;
      var bits = [];
      for (var i = 14; i >= 0; i--) bits.push((fmt >> i) & 1);
      return bits;
    }

    function placeFormat(m, ecIdx, maskPat) {
      var bits = makeFormatBits(ecIdx, maskPat);
      var s = m.size;
      for (var i = 0; i <= 5; i++) { m.data[8][i] = bits[i]; m.data[i][8] = bits[i]; }
      m.data[8][7] = bits[6];
      m.data[8][8] = bits[7];
      m.data[7][8] = bits[8];
      for (var i = 0; i <= 6; i++) m.data[s - 1 - i][8] = bits[i];
      for (var i = 0; i <= 7; i++) m.data[8][s - 8 + i] = bits[14 - i];
      for (var y2 = 0; y2 < s; y2++)
        for (var x2 = 0; x2 < s; x2++)
          if (m.data[y2][x2] === -1) m.data[y2][x2] = 0;
    }

    function penaltyScore(m) {
      var s = m.size, score = 0;
      for (var y = 0; y < s; y++) {
        var cnt = 1;
        for (var x = 1; x < s; x++) {
          if (m.data[y][x] === m.data[y][x - 1]) { cnt++; } else { if (cnt >= 5) score += cnt - 2; cnt = 1; }
        }
        if (cnt >= 5) score += cnt - 2;
      }
      for (var x = 0; x < s; x++) {
        var cnt = 1;
        for (var y = 1; y < s; y++) {
          if (m.data[y][x] === m.data[y - 1][x]) { cnt++; } else { if (cnt >= 5) score += cnt - 2; cnt = 1; }
        }
        if (cnt >= 5) score += cnt - 2;
      }
      for (var y = 0; y < s - 1; y++)
        for (var x = 0; x < s - 1; x++) {
          var v = m.data[y][x];
          if (v === m.data[y][x + 1] && v === m.data[y + 1][x] && v === m.data[y + 1][x + 1]) score += 3;
        }
      for (var y = 0; y < s; y++)
        for (var x = 0; x < s - 6; x++) {
          var pat = "";
          for (var k = 0; k < 7; k++) pat += m.data[y][x + k];
          if (pat === "1011101" || pat === "0100010") score += 40;
        }
      for (var x = 0; x < s; x++)
        for (var y = 0; y < s - 6; y++) {
          var pat = "";
          for (var k = 0; k < 7; k++) pat += m.data[y + k][x];
          if (pat === "1011101" || pat === "0100010") score += 40;
        }
      var dark = 0;
      for (var y = 0; y < s; y++)
        for (var x = 0; x < s; x++)
          if (m.data[y][x] === 1) dark++;
      var pct = Math.round((dark / (s * s)) * 100);
      score += Math.abs(Math.floor(pct / 5) * 5 - 50) / 5 * 10;
      return score;
    }

    function generateQR(text, ecLevel) {
      ecLevel = ecLevel || "M";
      var enc = new QR8bitByte(text);
      var ecIdx = EC_LEVEL_MAP[ecLevel];
      var ver = selectVersion(enc.getLength(), ecIdx);
      if (ver < 0) return null;

      var bb = new BitBuffer();
      bb.put(enc.mode, 4);
      bb.put(enc.getLength(), 8);
      enc.write(bb);
      bb.put(0, 4);
      while (bb.length % 8 !== 0) bb.put(0, 1);

      var vd = VERSION_DATA[ver];
      var dataBytes = vd.data[ecIdx];
      var dataBits = dataBytes * 8;
      while (bb.length < dataBits) {
        bb.put(0xec, 8);
        if (bb.length >= dataBits) break;
        bb.put(0x11, 8);
      }

      var buf = [];
      for (var i = 0; i < dataBits; i++) buf.push(bb.get(i) ? 1 : 0);

      var ecPB = vd.ecPB[ecIdx];
      var nBlocks = vd.blocks[ecIdx];
      var baseSize = Math.floor(dataBytes / nBlocks);
      var extra = dataBytes % nBlocks;
      var ecPoly = rsGenPoly(ecPB);

      var dataBlks = [], ecBlks = [];
      var off = 0;
      for (var b = 0; b < nBlocks; b++) {
        var sz = baseSize + (b < extra ? 1 : 0);
        var blk = [];
        for (var i2 = 0; i2 < sz; i2++) {
          var byteVal = 0;
          var baseBit = off * 8 + i2 * 8;
          for (var j = 0; j < 8; j++) {
            if (baseBit + j < buf.length)
              byteVal = (byteVal << 1) | (buf[baseBit + j] || 0);
            else byteVal <<= 1;
          }
          blk.push(byteVal);
        }
        var ecR = rsMod(blk.concat(new Array(ecPB).fill(0)), ecPoly);
        dataBlks.push(blk);
        ecBlks.push(ecR);
        off += sz;
      }

      var finalBits = [];
      var maxData = baseSize + (extra > 0 ? 1 : 0);
      for (var i = 0; i < maxData; i++) {
        for (var b = 0; b < nBlocks; b++) {
          if (i < dataBlks[b].length) {
            var bv = dataBlks[b][i];
            for (var j = 7; j >= 0; j--) finalBits.push((bv >> j) & 1);
          }
        }
      }
      for (var i = 0; i < ecPB; i++) {
        for (var b = 0; b < nBlocks; b++) {
          if (i < ecBlks[b].length) {
            var bv = ecBlks[b][i];
            for (var j = 7; j >= 0; j--) finalBits.push((bv >> j) & 1);
          }
        }
      }

      var m = makeMatrix(ver * 4 + 17);
      addFinder(m);
      addTiming(m);
      addAlignment(m, ver);
      reserveFormat(m);
      placeData(m, finalBits);

      var bestScore = Infinity, bestMask = 0;
      for (var mask = 0; mask < 8; mask++) {
        var tm = makeMatrix(m.size);
        for (var yy = 0; yy < m.size; yy++)
          for (var xx = 0; xx < m.size; xx++) tm.data[yy][xx] = m.data[yy][xx];
        applyMask(tm, mask);
        placeFormat(tm, ecIdx, mask);
        var sc = penaltyScore(tm);
        if (sc < bestScore) { bestScore = sc; bestMask = mask; }
      }

      applyMask(m, bestMask);
      placeFormat(m, ecIdx, bestMask);
      return m;
    }

    return {
      toCanvas: function (canvas, text, opts) {
        opts = opts || {};
        var qr = generateQR(text, opts.ecLevel || "M");
        if (!qr) return;
        var cell = opts.cellSize || 4;
        var margin = opts.margin || 4;
        var size = qr.size;
        canvas.width = (size + margin * 2) * cell;
        canvas.height = (size + margin * 2) * cell;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#000000";
        for (var y = 0; y < size; y++)
          for (var x = 0; x < size; x++)
            if (qr.data[y][x] === 1)
              ctx.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
      }
    };
  })();


  // ===============================================
  // JSON 工具
  // ===============================================

  function formatJSON(str) {
    return JSON.stringify(JSON.parse(str), null, 2);
  }

  function compressJSON(str) {
    return JSON.stringify(JSON.parse(str));
  }

  function highlightJSON(str) {
    return str
      .replace(/("(?:\\.|[^"\\])*")\s*:/g, "<span class=\"json-key\">$1</span>:")
      .replace(/:(\s*)("(?:\\.|[^"\\])*")/g, ":<span class=\"json-string\">$1$2</span>")
      .replace(/:\s*(true|false)/g, ": <span class=\"json-bool\">$1</span>")
      .replace(/:\s*(\d+\.?\d*)/g, ": <span class=\"json-num\">$1</span>")
      .replace(/:\s*(null)/g, ": <span class=\"json-null\">$1</span>");
  }


  // ===============================================
  // UI
  // ===============================================

  document.addEventListener("DOMContentLoaded", function () {

    var tabs = document.querySelectorAll(".tab");
    var panels = {
      markdown: document.getElementById("panel-markdown"),
      qrcode: document.getElementById("panel-qrcode"),
      json: document.getElementById("panel-json")
    };

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var target = tab.getAttribute("data-tab");
        Object.keys(panels).forEach(function (k) { panels[k].classList.remove("active"); });
        panels[target].classList.add("active");
      });
    });

    // Markdown
    (function () {
      var input = document.getElementById("md-input");
      var preview = document.getElementById("md-preview");
      var copyBtn = document.getElementById("md-copy");
      var clearBtn = document.getElementById("md-clear");
      var loadBtn = document.getElementById("md-load-example");

      function update() { preview.innerHTML = renderMarkdown(input.value); }

      input.addEventListener("input", update);

      copyBtn.addEventListener("click", function () {
        var html = preview.innerHTML;
        if (html.indexOf("placeholder-text") !== -1) return;
        var fullHtml = "<section style=\"padding: 10px 16px;\">" + html + "</section>";
        navigator.clipboard.writeText(fullHtml).then(function () {
          copyBtn.textContent = "已复制!";
          setTimeout(function () { copyBtn.textContent = "复制到公众号"; }, 2000);
        }).catch(function () {
          var ta = document.createElement("textarea");
          ta.value = fullHtml;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          copyBtn.textContent = "已复制!";
          setTimeout(function () { copyBtn.textContent = "复制到公众号"; }, 2000);
        });
      });

      clearBtn.addEventListener("click", function () { input.value = ""; update(); });

      loadBtn.addEventListener("click", function () {
        input.value = "# \u6B22\u8FCE\u4F7F\u7528\u516C\u4F17\u53F7\u6392\u7248\u5DE5\u5177\n\n\u8FD9\u662F\u4E00\u7BC7**\u793A\u4F8B\u6587\u7AE0**\uFF0C\u5C55\u793A\u4E86\u5DE5\u5177\u652F\u6301\u7684\u683C\u5F0F\u3002\n\n## \u6587\u672C\u683C\u5F0F\n\n\u652F\u6301 **\u52A0\u7C97**\u3001*\u659C\u4F53*\u3001`\u884C\u5185\u4EE3\u7801` \u7B49\u683C\u5F0F\u3002\n\n## \u5F15\u7528\n\n> \u8FD9\u662F\u5F15\u7528\u5185\u5BB9\uFF0C\u9002\u5408\u7528\u6765\u7A81\u51FA\u91CD\u8981\u89C2\u70B9\u3002\n\n## \u4EE3\u7801\u5757\n\n```javascript\nfunction hello() {\n  console.log(\"Hello, WeChat!\");\n}\n```\n\n## \u5217\u8868\n\n- \u7B2C\u4E00\u9879\n- \u7B2C\u4E8C\u9879\n- \u7B2C\u4E09\u9879\n\n## \u8868\u683C\n\n| \u529F\u80FD | \u652F\u6301\u60C5\u51B5 |\n|---|----------|\n| \u52A0\u7C97 | \u652F\u6301     |\n| \u4EE3\u7801 | \u652F\u6301     |\n| \u5217\u8868 | \u652F\u6301     |\n\n---\n\n> \u5F00\u59CB\u5199\u4F60\u7684\u6587\u7AE0\u5427\uFF01";
        update();
      });

      loadBtn.click();
    })();

    // QR Code
    (function () {
      var input = document.getElementById("qr-input");
      var canvas = document.getElementById("qr-canvas");
      var sizeSelect = document.getElementById("qr-size");
      var downloadBtn = document.getElementById("qr-download");

      function gen() {
        var text = input.value.trim();
        if (!text) {
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return;
        }
        var size = parseInt(sizeSelect.value);
        var cell = Math.max(1, Math.floor(size / 33));
        qrcode.toCanvas(canvas, text, { cellSize: cell, margin: 2 });
      }

      input.addEventListener("input", gen);
      sizeSelect.addEventListener("change", function () {
        canvas.width = parseInt(this.value);
        canvas.height = parseInt(this.value);
        gen();
      });

      downloadBtn.addEventListener("click", function () {
        var link = document.createElement("a");
        link.download = "qrcode.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
      });

      input.value = "https://github.com";
      gen();
    })();

    // JSON
    (function () {
      var input = document.getElementById("json-input");
      var output = document.getElementById("json-output");
      var formatBtn = document.getElementById("json-format");
      var compressBtn = document.getElementById("json-compress");
      var clearBtn = document.getElementById("json-clear");
      var copyBtn = document.getElementById("json-copy");

      function show(s) {
        output.innerHTML = highlightJSON(s);
      }
      function showErr(msg) {
        output.textContent = "\u89E3\u6790\u9519\u8BEF: " + msg;
      }

      formatBtn.addEventListener("click", function () {
        var v = input.value.trim();
        if (!v) return;
        try { show(formatJSON(v)); } catch (e) { showErr(e.message); }
      });

      compressBtn.addEventListener("click", function () {
        var v = input.value.trim();
        if (!v) return;
        try { show(compressJSON(v)); } catch (e) { showErr(e.message); }
      });

      clearBtn.addEventListener("click", function () {
        input.value = "";
        output.innerHTML = "<span class=\"placeholder-text\">\u70B9\u51FB\u201C\u683C\u5F0F\u5316\u201D\u67E5\u770B\u7ED3\u679C</span>";
      });

      copyBtn.addEventListener("click", function () {
        var text = output.textContent;
        if (!text || text.indexOf("placeholder-text") !== -1) return;
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.textContent = "\u5DF2\u590D\u5236!";
          setTimeout(function () { copyBtn.textContent = "\u590D\u5236"; }, 2000);
        }).catch(function () {
          var ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          copyBtn.textContent = "\u5DF2\u590D\u5236!";
          setTimeout(function () { copyBtn.textContent = "\u590D\u5236"; }, 2000);
        });
      });

      input.value = '{\n  "name": "\u5DE5\u5177\u7BB1",\n  "version": "1.0",\n  "tools": ["markdown", "qrcode", "json"],\n  "active": true,\n  "count": 42\n}';
    })();

  });

})();
