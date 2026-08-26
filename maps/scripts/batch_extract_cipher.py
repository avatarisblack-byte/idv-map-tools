import json
import os
import re


def extract_cipher_from_text(raw_code: str):
    # 提取 downloadData JSON 对象
    match = re.search(
        r"const\s+downloadData\s*=\s*(\{.*?\});", raw_code, re.DOTALL
    )
    if not match:
        # 兼容直接粘贴纯 JSON 的情况
        match = re.search(r"(\{.*\})", raw_code, re.DOTALL)
        if not match:
            raise ValueError("未找到有效的 JSON 数据")

    data = json.loads(match.group(1))
    map_title = data.get("title", "未知地图")
    groups_data = []

    # 提取密码机刷点
    for tab in data.get("tabs", []):
        if tab.get("name") == "密码机刷点":
            for group in tab.get("groups", []):
                points = [
                    {"x": p["x"], "y": p["y"]} for p in group.get("points", [])
                ]
                groups_data.append(
                    {"group": group.get("name", ""), "points": points}
                )

    return map_title, groups_data


def batch_process(input_dir=None, output_dir=None):
    here = os.path.dirname(os.path.abspath(__file__))
    input_dir = input_dir or os.path.join(here, '..', 'raw')
    output_dir = output_dir or os.path.join(here, '..', 'ciphers')
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(input_dir):
        os.makedirs(input_dir, exist_ok=True)
        print(f"已自动创建【{input_dir}】文件夹！")
        print("请将所有地图源码文件（.txt 或 .js 格式）放入该文件夹后重新运行。")
        return

    all_summary = {}
    files = [
        f
        for f in os.listdir(input_dir)
        if f.endswith((".txt", ".js", ".json"))
    ]

    if not files:
        print(f"【{input_dir}】文件夹中未发现 txt/js 文件，请先放数据源文件。")
        return

    for filename in files:
        filepath = os.path.join(input_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                raw_code = f.read()

            map_title, cipher_data = extract_cipher_from_text(raw_code)

            if cipher_data:
                # 导出单地图 JSON
                out_file = os.path.join(output_dir, f"{map_title}_密码机.json")
                with open(out_file, "w", encoding="utf-8") as f:
                    json.dump(cipher_data, f, ensure_ascii=False, indent=2)

                all_summary[map_title] = cipher_data
                print(f"✅ 成功提取: {filename} -> {map_title}_密码机.json")
            else:
                print(f"⚠️ 跳过: {filename}（未在数据中找到密码机刷点）")

        except Exception as e:
            print(f"❌ 处理失败 {filename}: {e}")

    # 生成合并总表
    if all_summary:
        summary_path = os.path.join(output_dir, "_所有地图密码机汇总.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(all_summary, f, ensure_ascii=False, indent=2)
        print(f"\n🎉 批量导出完成！已在【{output_dir}】目录生成各自独立及汇总文件。")


if __name__ == "__main__":
    batch_process()