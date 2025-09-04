# Sace.io Database Guide

This guide explains how to access and manage the Sace.io database system, including the admin dashboard and AI training infrastructure.

## 🗄️ Database Overview

Sace.io uses a comprehensive database system with two main components:

### 1. **User Data Database**
- **Purpose**: Store user profiles, avatars, and feedback
- **Access**: User dashboard and admin panel
- **Data**: User accounts, generated avatars, ratings, reviews

### 2. **Audit Logs Database**
- **Purpose**: Security compliance and activity tracking
- **Access**: Admin panel only
- **Data**: All user activities, system events, security logs

## 🚀 Quick Start

### 1. Setup Database
```bash
# Run the setup script
./setup.sh

# Or manually setup database
cd backend
npm run setup
```

### 2. Access Admin Dashboard
```bash
# Start admin dashboard
./start-admin.sh

# Access at: http://localhost:8081
# Login: admin@sace.io / admin123
```

### 3. View Database Statistics
```bash
cd backend
npm run stats
```

## 📊 Admin Dashboard Features

### Dashboard Overview
- **Real-time Statistics**: Users, avatars, feedback counts
- **Charts & Graphs**: User growth, avatar generation trends
- **Recent Activity**: Live feed of system activities
- **System Health**: Performance metrics and status

### User Management
- **View All Users**: Search, filter, and paginate users
- **User Details**: Profile information, avatar history, activity
- **User Actions**: Edit profiles, delete accounts, view statistics
- **Export Data**: Download user data in JSON/CSV format

### Avatar Management
- **Avatar Gallery**: View all generated avatars
- **Quality Analysis**: Track generation success rates
- **Download Tracking**: Monitor avatar download statistics
- **Bulk Operations**: Delete, export, or analyze multiple avatars

### Feedback Management
- **Rating Analysis**: View user satisfaction scores
- **Review Management**: Read and moderate user reviews
- **Trend Analysis**: Track feedback patterns over time
- **Quality Insights**: Identify areas for improvement

### Audit Logs
- **Security Monitoring**: Track all system activities
- **Compliance Reports**: Generate audit trails
- **Error Tracking**: Monitor system errors and issues
- **User Activity**: Detailed logs of user actions

## 🤖 AI Training & Testing

### Training Infrastructure
The system includes a complete AI training pipeline:

#### 1. **Data Preparation**
```bash
# Prepare training data from database
curl -X POST http://localhost:3000/api/training/prepare-data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dataSource": "database"}'
```

#### 2. **Model Training**
```bash
# Start training process
curl -X POST http://localhost:3000/api/training/train \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"models": ["faceDetection", "expressionRecognition"]}'
```

#### 3. **Model Evaluation**
```bash
# Test trained models
curl -X POST http://localhost:3000/api/training/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Training Models Available

#### Face Detection Model
- **Purpose**: Detect and locate faces in images
- **Input**: 224x224x3 image tensors
- **Output**: Bounding box coordinates (x, y, width, height)
- **Training Data**: User-uploaded images with face annotations

#### Expression Recognition Model
- **Purpose**: Classify facial expressions
- **Input**: 68 facial landmark points
- **Output**: Expression probabilities (neutral, smile, frown, surprise, anger)
- **Training Data**: Face landmarks with expression labels

#### Accessory Detection Model
- **Purpose**: Detect glasses, earrings, hats, etc.
- **Input**: Face region images
- **Output**: Accessory presence probabilities
- **Training Data**: Annotated face images with accessory labels

### Model Evaluation Metrics

#### Accuracy Metrics
- **Overall Accuracy**: Percentage of correct predictions
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1 Score**: Harmonic mean of precision and recall

#### Performance Analysis
- **Confusion Matrix**: Detailed breakdown of predictions
- **ROC Curve**: Receiver Operating Characteristic analysis
- **Cross-Validation**: K-fold validation for robust evaluation
- **Error Analysis**: Common misclassification patterns

## 🔧 Database Management

### Manual Database Operations

#### 1. **Connect to Database**
```bash
# MongoDB shell
mongosh mongodb://localhost:27017/sace_io

# Or use MongoDB Compass
# Connection string: mongodb://localhost:27017/sace_io
```

#### 2. **View Collections**
```javascript
// List all collections
show collections

// View collection statistics
db.users.stats()
db.avatars.stats()
db.feedbacks.stats()
db.auditlogs.stats()
```

#### 3. **Query Data**
```javascript
// Find all users
db.users.find()

// Find verified users
db.users.find({verified: true})

// Find avatars by method
db.avatars.find({method: "live_scan"})

// Find recent feedback
db.feedbacks.find().sort({createdAt: -1}).limit(10)
```

#### 4. **Export Data**
```bash
# Export all data
cd backend
npm run export

# Export specific collection
mongodump --db sace_io --collection users --out backup/
```

### Database Maintenance

#### 1. **Cleanup Operations**
```bash
# Clean up old data
cd backend
npm run cleanup

# Or via API
curl -X POST http://localhost:3000/api/admin/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cleanupTypes": ["expiredCodes", "oldLogs", "failedAvatars"]}'
```

#### 2. **Backup Database**
```bash
# Create backup
mongodump --db sace_io --out backup/$(date +%Y%m%d_%H%M%S)

# Restore backup
mongorestore --db sace_io backup/20231201_120000/sace_io/
```

#### 3. **Performance Monitoring**
```javascript
// Check database performance
db.runCommand({serverStatus: 1})

// Check slow queries
db.setProfilingLevel(2, {slowms: 100})
db.system.profile.find().sort({ts: -1}).limit(5)
```

## 📈 Analytics & Reporting

### Built-in Reports

#### 1. **User Analytics**
- User registration trends
- Active user statistics
- User engagement metrics
- Geographic distribution

#### 2. **Avatar Analytics**
- Generation success rates
- Popular avatar styles
- Quality distribution
- Processing time analysis

#### 3. **Feedback Analytics**
- Satisfaction trends
- Common issues
- Improvement suggestions
- Rating distribution

#### 4. **System Analytics**
- Performance metrics
- Error rates
- Resource usage
- Security events

### Custom Reports

#### 1. **Generate Custom Report**
```bash
# Via admin dashboard
# Go to Analytics > Custom Reports
# Select data sources, filters, and output format

# Via API
curl -X POST http://localhost:3000/api/admin/reports \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "user_engagement",
    "startDate": "2023-01-01",
    "endDate": "2023-12-31",
    "format": "json"
  }'
```

#### 2. **Export Reports**
- **JSON Format**: Machine-readable data
- **CSV Format**: Spreadsheet compatible
- **PDF Format**: Human-readable reports
- **Excel Format**: Advanced analytics

## 🔒 Security & Privacy

### Data Protection
- **Encryption**: All sensitive data encrypted at rest
- **Access Control**: Role-based permissions
- **Audit Logging**: Complete activity tracking
- **Data Retention**: Configurable retention policies

### Compliance Features
- **GDPR Compliance**: Data export and deletion
- **Privacy Controls**: User data management
- **Security Monitoring**: Real-time threat detection
- **Compliance Reports**: Automated compliance reporting

### Access Control
```javascript
// Admin permissions
{
  "read": true,
  "write": true,
  "delete": true,
  "admin": true
}

// User permissions
{
  "read": true,
  "write": false,
  "delete": false,
  "admin": false
}
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. **Database Connection Issues**
```bash
# Check MongoDB status
brew services list | grep mongodb
# or
sudo systemctl status mongod

# Check connection
mongosh mongodb://localhost:27017/sace_io
```

#### 2. **Admin Dashboard Access**
```bash
# Check if admin user exists
cd backend
node -e "
const {User} = require('./models');
User.findOne({email: 'admin@sace.io'}).then(user => {
  console.log('Admin user:', user ? 'exists' : 'not found');
});
"
```

#### 3. **Training Data Issues**
```bash
# Check training data
cd backend
node -e "
const {Avatar} = require('./models');
Avatar.countDocuments().then(count => {
  console.log('Total avatars:', count);
});
"
```

### Performance Optimization

#### 1. **Database Indexing**
```javascript
// Create indexes for better performance
db.users.createIndex({email: 1})
db.avatars.createIndex({userId: 1, createdAt: -1})
db.feedbacks.createIndex({rating: 1})
db.auditlogs.createIndex({timestamp: -1})
```

#### 2. **Query Optimization**
```javascript
// Use projection to limit fields
db.users.find({}, {email: 1, name: 1, createdAt: 1})

// Use pagination for large datasets
db.users.find().skip(0).limit(20).sort({createdAt: -1})
```

## 📚 API Reference

### Admin API Endpoints

#### Authentication
```bash
# Login
POST /api/auth/login
{
  "email": "admin@sace.io",
  "password": "admin123"
}

# Verify token
GET /api/admin/dashboard
Authorization: Bearer <token>
```

#### User Management
```bash
# Get users
GET /api/admin/users?page=1&limit=20&search=query

# Get user details
GET /api/admin/users/:userId

# Update user
PUT /api/admin/users/:userId
{
  "name": "New Name",
  "verified": true
}

# Delete user
DELETE /api/admin/users/:userId
```

#### Data Export
```bash
# Export data
POST /api/admin/export
{
  "format": "json",
  "dataTypes": ["users", "avatars", "feedbacks"]
}
```

### Training API Endpoints

#### Model Training
```bash
# Initialize training
POST /api/training/initialize

# Prepare data
POST /api/training/prepare-data
{
  "dataSource": "database"
}

# Start training
POST /api/training/train
{
  "models": ["faceDetection", "expressionRecognition"]
}

# Test models
POST /api/training/test
```

#### Model Evaluation
```bash
# Load model
POST /api/evaluation/load-model
{
  "modelPath": "models/trained/face_detection"
}

# Evaluate model
POST /api/evaluation/evaluate

# Cross validation
POST /api/evaluation/cross-validate
{
  "k": 5
}
```

## 🎯 Best Practices

### Database Management
1. **Regular Backups**: Schedule daily backups
2. **Monitor Performance**: Track query performance
3. **Clean Old Data**: Regular cleanup of expired data
4. **Index Optimization**: Create appropriate indexes

### Security
1. **Strong Passwords**: Use complex admin passwords
2. **Regular Updates**: Keep dependencies updated
3. **Access Monitoring**: Monitor admin access
4. **Data Encryption**: Ensure all sensitive data is encrypted

### Training
1. **Quality Data**: Use high-quality training data
2. **Regular Evaluation**: Test models regularly
3. **Performance Monitoring**: Track model performance
4. **Continuous Learning**: Retrain models with new data

## 📞 Support

### Getting Help
- **Documentation**: Check README.md files
- **Issues**: Report bugs on GitHub
- **Community**: Join Discord community
- **Email**: Contact support@sace.io

### Resources
- **API Documentation**: `/api-docs` endpoint
- **Admin Guide**: `admin/README.md`
- **Backend Guide**: `backend/README.md`
- **Training Guide**: `backend/ai/README.md`

---

**Happy Database Management! 🎉**

For more information, visit [sace.io](https://sace.io) or check the main README.md file.
