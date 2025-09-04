#!/bin/bash

# Sace.io Setup Script
# This script sets up the complete Sace.io environment

set -e

echo "🚀 Setting up Sace.io - AI Avatar Creator"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
        
        # Check if version is 16 or higher
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 16 ]; then
            print_error "Node.js version 16 or higher is required. Current version: $NODE_VERSION"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 16 or higher."
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    print_status "Checking npm installation..."
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm is installed: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
}

# Check if MongoDB is installed
check_mongodb() {
    print_status "Checking MongoDB installation..."
    if command -v mongod &> /dev/null; then
        print_success "MongoDB is installed"
    else
        print_warning "MongoDB is not installed. You can install it or use MongoDB Atlas."
        print_status "For local installation:"
        print_status "  macOS: brew install mongodb-community"
        print_status "  Ubuntu: sudo apt-get install mongodb"
        print_status "  Or use MongoDB Atlas: https://www.mongodb.com/atlas"
    fi
}

# Check if Redis is installed (optional)
check_redis() {
    print_status "Checking Redis installation..."
    if command -v redis-server &> /dev/null; then
        print_success "Redis is installed"
    else
        print_warning "Redis is not installed. It's optional but recommended for caching."
        print_status "For local installation:"
        print_status "  macOS: brew install redis"
        print_status "  Ubuntu: sudo apt-get install redis-server"
    fi
}

# Install backend dependencies
install_backend_deps() {
    print_status "Installing backend dependencies..."
    cd backend
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Backend dependencies installed"
    else
        print_error "package.json not found in backend directory"
        exit 1
    fi
    
    cd ..
}

# Create environment file
create_env_file() {
    print_status "Creating environment configuration..."
    
    if [ ! -f "backend/.env" ]; then
        cat > backend/.env << EOF
# Sace.io Environment Configuration

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/sace_io
REDIS_URI=redis://localhost:6379

# Security Configuration
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
BCRYPT_ROUNDS=12

# Email Configuration (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@sace.io

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/jpg,image/png,image/webp
UPLOAD_DIR=uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
STRICT_RATE_LIMIT_MAX_REQUESTS=10

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,https://sace.io,https://www.sace.io

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30

# AI/ML Configuration
FACE_DETECTION_MODEL_URL=https://tfhub.dev/mediapipe/tfjs-model/face_detection/1/default/1
FACE_LANDMARKS_MODEL_URL=https://tfhub.dev/mediapipe/tfjs-model/face_landmarks/1/default/1

# Avatar Generation Configuration
AVATAR_QUALITY=high
AVATAR_FORMAT=png
AVATAR_MAX_SIZE=2048

# Privacy Configuration
DATA_RETENTION_DAYS=365
AUTO_DELETE_INACTIVE_USERS=true
INACTIVE_USER_THRESHOLD_DAYS=90

# Development Configuration
DEBUG=true
ENABLE_SWAGGER=true
SWAGGER_URL=/api-docs

# Admin Configuration
ADMIN_EMAIL=admin@sace.io
ADMIN_PASSWORD=admin123

# Create Sample Data
CREATE_SAMPLE_DATA=true
EOF
        print_success "Environment file created at backend/.env"
        print_warning "Please update the email configuration in backend/.env"
    else
        print_warning "Environment file already exists at backend/.env"
    fi
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p backend/logs
    mkdir -p backend/uploads
    mkdir -p backend/training_data
    mkdir -p backend/models/trained
    mkdir -p backend/test_results
    mkdir -p admin/logs
    
    print_success "Directories created"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    cd backend
    
    # Check if MongoDB is running
    if command -v mongod &> /dev/null; then
        if pgrep -x "mongod" > /dev/null; then
            print_success "MongoDB is running"
        else
            print_warning "MongoDB is not running. Starting MongoDB..."
            if command -v brew &> /dev/null; then
                brew services start mongodb-community
            elif command -v systemctl &> /dev/null; then
                sudo systemctl start mongod
            else
                print_warning "Please start MongoDB manually"
            fi
        fi
    fi
    
    # Initialize database with sample data
    print_status "Initializing database with sample data..."
    node database/setup.js setup
    
    cd ..
    print_success "Database setup completed"
}

# Start services
start_services() {
    print_status "Starting services..."
    
    # Start Redis if available
    if command -v redis-server &> /dev/null; then
        if ! pgrep -x "redis-server" > /dev/null; then
            print_status "Starting Redis..."
            if command -v brew &> /dev/null; then
                brew services start redis
            elif command -v systemctl &> /dev/null; then
                sudo systemctl start redis
            else
                redis-server --daemonize yes
            fi
        fi
    fi
    
    print_success "Services started"
}

# Create startup scripts
create_startup_scripts() {
    print_status "Creating startup scripts..."
    
    # Backend startup script
    cat > start-backend.sh << 'EOF'
#!/bin/bash
echo "Starting Sace.io Backend Server..."
cd backend
npm start
EOF
    chmod +x start-backend.sh
    
    # Frontend startup script
    cat > start-frontend.sh << 'EOF'
#!/bin/bash
echo "Starting Sace.io Frontend..."
# Use any static file server
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080
elif command -v node &> /dev/null; then
    npx serve -s . -l 8080
else
    echo "Please install a static file server or open index.html in your browser"
fi
EOF
    chmod +x start-frontend.sh
    
    # Admin dashboard startup script
    cat > start-admin.sh << 'EOF'
#!/bin/bash
echo "Starting Sace.io Admin Dashboard..."
cd admin
# Use any static file server
if command -v python3 &> /dev/null; then
    python3 -m http.server 8081
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8081
elif command -v node &> /dev/null; then
    npx serve -s . -l 8081
else
    echo "Please install a static file server or open admin/index.html in your browser"
fi
EOF
    chmod +x start-admin.sh
    
    print_success "Startup scripts created"
}

# Main setup function
main() {
    echo "Starting Sace.io setup..."
    echo ""
    
    # Check prerequisites
    check_nodejs
    check_npm
    check_mongodb
    check_redis
    
    echo ""
    
    # Install dependencies
    install_backend_deps
    
    echo ""
    
    # Create configuration
    create_env_file
    create_directories
    
    echo ""
    
    # Setup database
    setup_database
    
    echo ""
    
    # Start services
    start_services
    
    echo ""
    
    # Create startup scripts
    create_startup_scripts
    
    echo ""
    print_success "Sace.io setup completed successfully!"
    echo ""
    echo "🎉 Setup Summary:"
    echo "=================="
    echo "✅ Backend dependencies installed"
    echo "✅ Environment configuration created"
    echo "✅ Database initialized with sample data"
    echo "✅ Admin user created (admin@sace.io / admin123)"
    echo "✅ Startup scripts created"
    echo ""
    echo "🚀 Next Steps:"
    echo "=============="
    echo "1. Start the backend server:"
    echo "   ./start-backend.sh"
    echo ""
    echo "2. Start the frontend (in a new terminal):"
    echo "   ./start-frontend.sh"
    echo ""
    echo "3. Start the admin dashboard (in a new terminal):"
    echo "   ./start-admin.sh"
    echo ""
    echo "4. Access the application:"
    echo "   Frontend: http://localhost:8080"
    echo "   Admin Dashboard: http://localhost:8081"
    echo "   Backend API: http://localhost:3000"
    echo ""
    echo "📚 Documentation:"
    echo "================="
    echo "   README.md - Complete documentation"
    echo "   backend/README.md - Backend API documentation"
    echo "   admin/README.md - Admin dashboard documentation"
    echo ""
    echo "🔧 Configuration:"
    echo "================="
    echo "   Edit backend/.env to configure email, database, etc."
    echo "   Admin login: admin@sace.io / admin123"
    echo ""
    echo "Happy coding! 🎨"
}

# Run main function
main "$@"
