#!/bin/bash

# Script de instalación de ClamAV para Medilink360
# Compatible con Ubuntu/Debian, CentOS/RHEL, y macOS

set -e

echo "🔍 Instalando ClamAV para Medilink360..."

# Detectar sistema operativo
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v apt-get &> /dev/null; then
        echo "📦 Detectado Ubuntu/Debian"
        install_ubuntu_debian
    elif command -v yum &> /dev/null; then
        echo "📦 Detectado CentOS/RHEL"
        install_centos_rhel
    else
        echo "❌ Sistema operativo no soportado"
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "🍎 Detectado macOS"
    install_macos
else
    echo "❌ Sistema operativo no soportado: $OSTYPE"
    exit 1
fi

echo "✅ Instalación completada"
echo "🔧 Configurando ClamAV..."

# Actualizar base de datos de virus
echo "🔄 Actualizando base de datos de virus..."
freshclam

# Verificar instalación
echo "🔍 Verificando instalación..."
clamscan --version

echo "✅ ClamAV instalado y configurado correctamente"
echo "📝 Para usar en desarrollo, ejecuta: npm run dev"

function install_ubuntu_debian() {
    echo "📦 Actualizando repositorios..."
    sudo apt-get update
    
    echo "📦 Instalando ClamAV..."
    sudo apt-get install -y clamav clamav-daemon
    
    echo "🔄 Iniciando servicio ClamAV..."
    sudo systemctl start clamav-daemon
    sudo systemctl enable clamav-daemon
    
    echo "🔄 Actualizando base de datos de virus..."
    sudo freshclam
}

function install_centos_rhel() {
    echo "📦 Instalando EPEL repository..."
    sudo yum install -y epel-release
    
    echo "📦 Instalando ClamAV..."
    sudo yum install -y clamav clamav-update
    
    echo "🔄 Actualizando base de datos de virus..."
    sudo freshclam
    
    echo "🔄 Iniciando servicio ClamAV..."
    sudo systemctl start clamav-daemon
    sudo systemctl enable clamav-daemon
}

function install_macos() {
    if ! command -v brew &> /dev/null; then
        echo "📦 Instalando Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    echo "📦 Instalando ClamAV..."
    brew install clamav
    
    echo "🔄 Actualizando base de datos de virus..."
    freshclam
}

# Crear directorio de logs si no existe
echo "📁 Creando directorio de logs..."
mkdir -p logs

echo "🎉 ¡Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Reinicia el servidor: npm run dev"
echo "2. Verifica la instalación: clamscan --version"
echo "3. Prueba un upload de archivo"
echo ""
echo "📚 Documentación: SECURITY_GUIDELINES.md" 