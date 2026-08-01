#!/bin/sh
# Сборка установочного архива провайдера AnyBalance.
# Запуск из корня репозитория: ./build-zip.sh
# Результат: install-zip/ab-internet-kirzach-telecom.zip
set -e
cd "$(dirname "$0")/provider"

FILES='anybalance-manifest.xml preferences.xml main.js library.js history.xml icon.png'
for f in $FILES; do
  [ -f "$f" ] || { echo "ОШИБКА: нет файла $f"; exit 1; }
done

mkdir -p ../install-zip
python3 - "$FILES" <<'EOF'
import sys, zipfile
files = sys.argv[1].split()
out = '../install-zip/ab-internet-kirzach-telecom.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f, f)
with zipfile.ZipFile(out) as z:
    print('Собран архив:', out)
    for i in z.infolist():
        print('  ', i.filename, i.file_size, 'байт')
EOF
