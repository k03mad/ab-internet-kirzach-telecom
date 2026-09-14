#!/bin/sh
# Сборка установочного архива провайдера AnyBalance.
# Запуск из корня репозитория: ./build-zip.sh
# Результат: install-zip/ab-internet-kirzach-telecom.zip
# Библиотека AB.* (depends) вшивается из официального репо — так же, как это
# делает сборка каталога (extra/development/tools/build/assemble_provider.js).
set -e
cd "$(dirname "$0")/provider"

FILES='anybalance-manifest.xml preferences.xml main.js history.xml icon.png'
for f in $FILES; do
  [ -f "$f" ] || { echo "ОШИБКА: нет файла $f"; exit 1; }
done

LIB='../../any-balance-providers/modules/library/build/head/library.min.js'
[ -f "$LIB" ] || { echo "ОШИБКА: нет библиотеки $LIB"; exit 1; }

mkdir -p ../install-zip
python3 - "$LIB" <<'EOF'
import sys, zipfile
lib = sys.argv[1]
out = '../install-zip/ab-internet-kirzach-telecom.zip'
# Архив самодостаточен: js модуля вшит в <files> как library.min.js (так же делает assemble_provider)
manifest = open('anybalance-manifest.xml', encoding='utf-8').read()
manifest = manifest.replace('<js>main.js</js>', '<js>library.min.js</js>\n\t\t<js>main.js</js>')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('anybalance-manifest.xml', manifest)
    for f in ('preferences.xml', 'main.js', 'history.xml', 'icon.png'):
        z.write(f, f)
    z.write(lib, 'library.min.js')
with zipfile.ZipFile(out) as z:
    print('Собран архив:', out)
    for i in z.infolist():
        print('  ', i.filename, i.file_size, 'байт')
EOF
