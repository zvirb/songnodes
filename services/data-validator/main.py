"""
Data Validator Service
Handles data quality validation, schema validation, and duplicate detection
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator, ValidationError
from typing import List, Optional, Dict, Any, Union, Set
from datetime import datetime, timedelta
import asyncio
import logging
import json
import os
import re
from enum import Enum
import hashlib

import redis
import asyncpg
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from fastapi.responses import PlainTextResponse
import httpx

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
validation_tasks_total = Counter('validation_tasks_total', 'Total validation tasks', ['validation_type', 'status'])
active_validations = Gauge('active_validations', 'Number of active validations', ['validation_type'])
validation_duration = Histogram('validation_duration_seconds', 'Validation duration', ['validation_type'])
validation_results = Counter('validation_results_total', 'Validation results', ['validation_type', 'result'])

# Initialize FastAPI app
app = FastAPI(
    title="Data Validator Service",
    description="Validates data quality and schema compliance for music track data",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for non-security-conscious app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

# Database configuration - use DATABASE_URL for connection pooling
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://musicdb_user:password@postgres:5432/musicdb")

# Parse DATABASE_URL for asyncpg connection
import urllib.parse
parsed_url = urllib.parse.urlparse(DATABASE_URL)
DATABASE_CONFIG = {
    "host": parsed_url.hostname,
    "port": parsed_url.port or 5432,
    "database": parsed_url.path[1:] if parsed_url.path else "musicdb",
    "user": parsed_url.username,
    "password": parsed_url.password
}

# Database connection pool
db_pool = None

# =====================
# Data Models
# =====================

class ValidationType(str, Enum):
    SCHEMA = "schema"
    QUALITY = "quality"
    DUPLICATE = "duplicate"
    BUSINESS_RULES = "business_rules"
    COMPLETENESS = "completeness"
    CONSISTENCY = "consistency"

class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

class ValidationStatus(str, Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    COMPLETED = "completed"
    FAILED = "failed"

class ValidationRule(BaseModel):
    """Validation rule definition"""
    id: str
    name: str
    description: str
    validation_type: ValidationType
    severity: ValidationSeverity
    enabled: bool = True
    parameters: Dict[str, Any] = {}

class ValidationIssue(BaseModel):
    """Validation issue found during validation"""
    rule_id: str
    rule_name: str
    severity: ValidationSeverity
    field: Optional[str] = None
    message: str
    value: Optional[str] = None
    suggestions: List[str] = []

class TrackData(BaseModel):
    """Track data to be validated"""
    id: Optional[str] = None
    source: str
    source_id: str
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    label: Optional[str] = None
    release_date: Optional[str] = None
    duration: Optional[str] = None
    bpm: Optional[Union[int, str]] = None
    key: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class ValidationTask(BaseModel):
    """Validation task configuration"""
    id: Optional[str] = None
    validation_types: List[ValidationType] = [ValidationType.SCHEMA, ValidationType.QUALITY]
    data: Union[TrackData, List[TrackData]]
    rules: Optional[List[str]] = None  # Specific rules to apply
    options: Dict[str, Any] = {}
    priority: int = Field(default=5, ge=1, le=10)
    status: ValidationStatus = ValidationStatus.PENDING
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class ValidationResult(BaseModel):
    """Result of validation operation"""
    task_id: str
    validation_types: List[ValidationType]
    status: ValidationStatus
    is_valid: bool
    score: float = Field(ge=0.0, le=1.0)  # Overall quality score
    total_issues: int
    error_count: int
    warning_count: int
    info_count: int
    processing_time: float
    issues: List[ValidationIssue] = []
    recommendations: List[str] = []

# =====================
# Validation Rules Registry
# =====================

VALIDATION_RULES = {
    # Schema validation rules
    "required_title": ValidationRule(
        id="required_title",
        name="Required Title",
        description="Track must have a title",
        validation_type=ValidationType.SCHEMA,
        severity=ValidationSeverity.ERROR
    ),
    "required_artist": ValidationRule(
        id="required_artist",
        name="Required Artist",
        description="Track must have an artist",
        validation_type=ValidationType.SCHEMA,
        severity=ValidationSeverity.ERROR
    ),
    "title_length": ValidationRule(
        id="title_length",
        name="Title Length",
        description="Title should be between 1 and 255 characters",
        validation_type=ValidationType.SCHEMA,
        severity=ValidationSeverity.WARNING,
        parameters={"min_length": 1, "max_length": 255}
    ),
    "artist_length": ValidationRule(
        id="artist_length",
        name="Artist Length",
        description="Artist name should be between 1 and 255 characters",
        validation_type=ValidationType.SCHEMA,
        severity=ValidationSeverity.WARNING,
        parameters={"min_length": 1, "max_length": 255}
    ),
    
    # Quality validation rules
    "title_quality": ValidationRule(
        id="title_quality",
        name="Title Quality",
        description="Title should not contain excessive special characters or be all caps",
        validation_type=ValidationType.QUALITY,
        severity=ValidationSeverity.WARNING
    ),
    "artist_quality": ValidationRule(
        id="artist_quality",
        name="Artist Quality",
        description="Artist name should be properly formatted",
        validation_type=ValidationType.QUALITY,
        severity=ValidationSeverity.WARNING
    ),
    "bpm_range": ValidationRule(
        id="bpm_range",
        name="BPM Range",
        description="BPM should be within reasonable range (50-200)",
        validation_type=ValidationType.QUALITY,
        severity=ValidationSeverity.WARNING,
        parameters={"min_bpm": 50, "max_bpm": 200}
    ),
    "duration_format": ValidationRule(
        id="duration_format",
        name="Duration Format",
        description="Duration should be in valid format (MM:SS or seconds)",
        validation_type=ValidationType.QUALITY,
        severity=ValidationSeverity.WARNING
    ),
    "url_validity": ValidationRule(
        id="url_validity",
        name="URL Validity",
        description="URL should be valid if provided",
        validation_type=ValidationType.QUALITY,
        severity=ValidationSeverity.WARNING
    ),
    
    # Completeness validation rules
    "metadata_completeness": ValidationRule(
        id="metadata_completeness",
        name="Metadata Completeness",
        description="Track should have essential metadata fields",
        validation_type=ValidationType.COMPLETENESS,
        severity=ValidationSeverity.INFO,
        parameters={"essential_fields": ["title", "artist", "genre", "release_date"]}
    ),
    
    # Consistency validation rules
    "genre_consistency": ValidationRule(
        id="genre_consistency",
        name="Genre Consistency",
        description="Genre should be from known list or follow naming conventions",
        validation_type=ValidationType.CONSISTENCY,
        severity=ValidationSeverity.INFO,
        parameters={"known_genres": [
            "House", "Tech House", "Techno", "Trance", "Progressive", "Dubstep",
            "Drum & Bass", "Hip-Hop", "Pop", "Rock", "Jazz", "Classical", "Reggae",
            "Ambient", "Downtempo", "Trap", "Alternative Rock", "Indie Rock", "Indie Pop"
        ]}
    ),
    "key_consistency": ValidationRule(
        id="key_consistency",
        name="Key Consistency",
        description="Musical key should follow standard notation",
        validation_type=ValidationType.CONSISTENCY,
        severity=ValidationSeverity.INFO,
        parameters={"valid_keys": [
            "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", 
            "G", "G#", "Ab", "A", "A#", "Bb", "B",
            "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", 
            "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
        ]}
    ),
    
    # Business rules
    "release_date_reasonable": ValidationRule(
        id="release_date_reasonable",
        name="Reasonable Release Date",
        description="Release date should not be in the future or too far in the past",
        validation_type=ValidationType.BUSINESS_RULES,
        severity=ValidationSeverity.WARNING,
        parameters={"min_year": 1900, "max_year": datetime.now().year + 1}
    ),
    "source_id_format": ValidationRule(
        id="source_id_format",
        name="Source ID Format",
        description="Source ID should follow expected format for the source",
        validation_type=ValidationType.BUSINESS_RULES,
        severity=ValidationSeverity.ERROR
    )
}

# =====================
# Validation Engine
# =====================

class SchemaValidator:
    """Validates data against schema requirements"""
    
    def __init__(self):
        self.rules = {k: v for k, v in VALIDATION_RULES.items() 
                     if v.validation_type == ValidationType.SCHEMA and v.enabled}
    
    async def validate(self, track: TrackData) -> List[ValidationIssue]:
        """Validate track against schema rules"""
        issues = []
        
        for rule_id, rule in self.rules.items():
            if rule_id == "required_title":
                if not track.title or not track.title.strip():
                    issues.append(ValidationIssue(
                        rule_id=rule_id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        field="title",
                        message="Title is required",
                        suggestions=["Add a valid title"]
                    ))
            
            elif rule_id == "required_artist":
                if not track.artist or not track.artist.strip():
                    issues.append(ValidationIssue(
                        rule_id=rule_id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        field="artist",
                        message="Artist is required",
                        suggestions=["Add a valid artist name"]
                    ))
            
            elif rule_id == "title_length":
                if track.title:
                    title_length = len(track.title)
                    min_len = rule.parameters.get("min_length", 1)
                    max_len = rule.parameters.get("max_length", 255)
                    
                    if title_length < min_len or title_length > max_len:
                        issues.append(ValidationIssue(
                            rule_id=rule_id,
                            rule_name=rule.name,
                            severity=rule.severity,
                            field="title",
                            message=f"Title length ({title_length}) outside valid range ({min_len}-{max_len})",
                            value=str(title_length),
                            suggestions=[f"Ensure title is between {min_len} and {max_len} characters"]
                        ))
            
            elif rule_id == "artist_length":
                if track.artist:
                    artist_length = len(track.artist)
                    min_len = rule.parameters.get("min_length", 1)
                    max_len = rule.parameters.get("max_length", 255)
                    
                    if artist_length < min_len or artist_length > max_len:
                        issues.append(ValidationIssue(
                            rule_id=rule_id,
                            rule_name=rule.name,
                            severity=rule.severity,
                            field="artist",
                            message=f"Artist length ({artist_length}) outside valid range ({min_len}-{max_len})",
                            value=str(artist_length),
                            suggestions=[f"Ensure artist name is between {min_len} and {max_len} characters"]
                        ))
        
        return issues

class QualityValidator:
    """Validates data quality and format"""
    
    def __init__(self):
        self.rules = {k: v for k, v in VALIDATION_RULES.items() 
                     if v.validation_type == ValidationType.QUALITY and v.enabled}
        
        # URL regex pattern
        self.url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    async def validate(self, track: TrackData) -> List[ValidationIssue]:
        """Validate track data quality"""
        issues = []
        
        for rule_id, rule in self.rules.items():
            if rule_id == "title_quality":
                if track.title:
                    issues.extend(self._validate_title_quality(track.title, rule))
            
            elif rule_id == "artist_quality":
                if track.artist:
                    issues.extend(self._validate_artist_quality(track.artist, rule))
            
            elif rule_id == "bpm_range":
                if track.bpm:
                    issues.extend(self._validate_bpm_range(track.bpm, rule))
            
            elif rule_id == "duration_format":
                if track.duration:
                    issues.extend(self._validate_duration_format(track.duration, rule))
            
            elif rule_id == "url_validity":
                if track.url:
                    issues.extend(self._validate_url(track.url, rule))
        
        return issues
    
    def _validate_title_quality(self, title: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate title quality"""
        issues = []
        
        # Check for all caps (more than 50% uppercase)
        if len(title) > 2:
            uppercase_ratio = sum(1 for c in title if c.isupper()) / len(title)
            if uppercase_ratio > 0.5:
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    field="title",
                    message="Title appears to be in ALL CAPS",
                    value=title,
                    suggestions=["Use proper title case"]
                ))
        
        # Check for excessive special characters
        special_chars = sum(1 for c in title if not c.isalnum() and c not in ' -()[].')
        if special_chars > len(title) * 0.2:  # More than 20% special characters
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=rule.severity,
                field="title",
                message="Title contains excessive special characters",
                value=title,
                suggestions=["Clean up title formatting"]
            ))
        
        return issues
    
    def _validate_artist_quality(self, artist: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate artist name quality"""
        issues = []
        
        # Check for all caps
        if len(artist) > 2:
            uppercase_ratio = sum(1 for c in artist if c.isupper()) / len(artist)
            if uppercase_ratio > 0.5:
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    field="artist",
                    message="Artist name appears to be in ALL CAPS",
                    value=artist,
                    suggestions=["Use proper name case"]
                ))
        
        # Check for common formatting issues
        if artist.startswith(('DJ ', 'dj ', 'Dj ')):
            if not artist.startswith('DJ '):
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=ValidationSeverity.INFO,
                    field="artist",
                    message="DJ prefix should be 'DJ ' (uppercase)",
                    value=artist,
                    suggestions=["Use 'DJ ' instead of 'dj ' or 'Dj '"]
                ))
        
        return issues
    
    def _validate_bpm_range(self, bpm: Union[int, str], rule: ValidationRule) -> List[ValidationIssue]:
        """Validate BPM range"""
        issues = []
        
        try:
            bpm_value = int(float(str(bpm)))
            min_bpm = rule.parameters.get("min_bpm", 50)
            max_bpm = rule.parameters.get("max_bpm", 200)
            
            if bpm_value < min_bpm or bpm_value > max_bpm:
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    field="bpm",
                    message=f"BPM {bpm_value} outside reasonable range ({min_bpm}-{max_bpm})",
                    value=str(bpm_value),
                    suggestions=[f"Verify BPM is correct, should be between {min_bpm} and {max_bpm}"]
                ))
        except (ValueError, TypeError):
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=ValidationSeverity.ERROR,
                field="bpm",
                message=f"Invalid BPM format: {bpm}",
                value=str(bpm),
                suggestions=["BPM should be a number"]
            ))
        
        return issues
    
    def _validate_duration_format(self, duration: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate duration format"""
        issues = []
        
        duration_str = str(duration).strip()
        
        # Check for MM:SS or HH:MM:SS format
        if ':' in duration_str:
            parts = duration_str.split(':')
            if len(parts) not in [2, 3]:
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    field="duration",
                    message=f"Invalid duration format: {duration}",
                    value=duration,
                    suggestions=["Use MM:SS or HH:MM:SS format"]
                ))
            else:
                try:
                    # Validate each part is numeric
                    for part in parts:
                        int(part)
                except ValueError:
                    issues.append(ValidationIssue(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        field="duration",
                        message=f"Duration contains non-numeric parts: {duration}",
                        value=duration,
                        suggestions=["Ensure all time parts are numbers"]
                    ))
        else:
            # Check if it's a number (seconds)
            try:
                seconds = float(duration_str)
                if seconds < 0 or seconds > 7200:  # 0 to 2 hours
                    issues.append(ValidationIssue(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        field="duration",
                        message=f"Duration in seconds ({seconds}) seems unreasonable",
                        value=duration,
                        suggestions=["Verify duration is correct"]
                    ))
            except ValueError:
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=rule.severity,
                    field="duration",
                    message=f"Invalid duration format: {duration}",
                    value=duration,
                    suggestions=["Use MM:SS format or seconds as number"]
                ))
        
        return issues
    
    def _validate_url(self, url: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate URL format"""
        issues = []
        
        if not self.url_pattern.match(url):
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=rule.severity,
                field="url",
                message=f"Invalid URL format: {url}",
                value=url,
                suggestions=["Ensure URL starts with http:// or https://"]
            ))
        
        return issues

class CompletenessValidator:
    """Validates data completeness"""
    
    def __init__(self):
        self.rules = {k: v for k, v in VALIDATION_RULES.items() 
                     if v.validation_type == ValidationType.COMPLETENESS and v.enabled}
    
    async def validate(self, track: TrackData) -> List[ValidationIssue]:
        """Validate data completeness"""
        issues = []
        
        for rule_id, rule in self.rules.items():
            if rule_id == "metadata_completeness":
                issues.extend(self._validate_metadata_completeness(track, rule))
        
        return issues
    
    def _validate_metadata_completeness(self, track: TrackData, rule: ValidationRule) -> List[ValidationIssue]:
        """Check if track has essential metadata fields"""
        issues = []
        
        essential_fields = rule.parameters.get("essential_fields", ["title", "artist"])
        missing_fields = []
        
        for field in essential_fields:
            value = getattr(track, field, None)
            if not value or (isinstance(value, str) and not value.strip()):
                missing_fields.append(field)
        
        if missing_fields:
            completeness_score = (len(essential_fields) - len(missing_fields)) / len(essential_fields)
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=rule.severity,
                field=None,
                message=f"Missing essential metadata fields: {', '.join(missing_fields)} "
                       f"(completeness: {completeness_score:.1%})",
                value=str(missing_fields),
                suggestions=[f"Add {field}" for field in missing_fields]
            ))
        
        return issues

class ConsistencyValidator:
    """Validates data consistency"""
    
    def __init__(self):
        self.rules = {k: v for k, v in VALIDATION_RULES.items() 
                     if v.validation_type == ValidationType.CONSISTENCY and v.enabled}
    
    async def validate(self, track: TrackData) -> List[ValidationIssue]:
        """Validate data consistency"""
        issues = []
        
        for rule_id, rule in self.rules.items():
            if rule_id == "genre_consistency":
                if track.genre:
                    issues.extend(self._validate_genre_consistency(track.genre, rule))
            
            elif rule_id == "key_consistency":
                if track.key:
                    issues.extend(self._validate_key_consistency(track.key, rule))
        
        return issues
    
    def _validate_genre_consistency(self, genre: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate genre consistency"""
        issues = []
        
        known_genres = rule.parameters.get("known_genres", [])
        if genre not in known_genres:
            # Find similar genres
            similar = [g for g in known_genres if g.lower() in genre.lower() or genre.lower() in g.lower()]
            
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=rule.severity,
                field="genre",
                message=f"Genre '{genre}' not in known genres list",
                value=genre,
                suggestions=similar[:3] if similar else ["Use standard genre names"]
            ))
        
        return issues
    
    def _validate_key_consistency(self, key: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate musical key consistency"""
        issues = []
        
        valid_keys = rule.parameters.get("valid_keys", [])
        if key not in valid_keys:
            # Find similar keys
            similar = [k for k in valid_keys if k.lower().startswith(key.lower()[:1])]
            
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=rule.severity,
                field="key",
                message=f"Key '{key}' not in standard notation",
                value=key,
                suggestions=similar[:3] if similar else ["Use standard key notation (e.g., C, Dm, F#)"]
            ))
        
        return issues

class BusinessRulesValidator:
    """Validates business rules"""
    
    def __init__(self):
        self.rules = {k: v for k, v in VALIDATION_RULES.items() 
                     if v.validation_type == ValidationType.BUSINESS_RULES and v.enabled}
    
    async def validate(self, track: TrackData) -> List[ValidationIssue]:
        """Validate business rules"""
        issues = []
        
        for rule_id, rule in self.rules.items():
            if rule_id == "release_date_reasonable":
                if track.release_date:
                    issues.extend(self._validate_release_date(track.release_date, rule))
            
            elif rule_id == "source_id_format":
                issues.extend(self._validate_source_id_format(track.source, track.source_id, rule))
        
        return issues
    
    def _validate_release_date(self, release_date: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate release date is reasonable"""
        issues = []
        
        try:
            # Try to parse the date
            from datetime import datetime
            
            # Common date formats
            date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%Y", "%B %d, %Y"]
            parsed_date = None
            
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(release_date.strip(), fmt)
                    break
                except ValueError:
                    continue
            
            if parsed_date:
                year = parsed_date.year
                min_year = rule.parameters.get("min_year", 1900)
                max_year = rule.parameters.get("max_year", datetime.now().year + 1)
                
                if year < min_year or year > max_year:
                    issues.append(ValidationIssue(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        field="release_date",
                        message=f"Release year {year} outside reasonable range ({min_year}-{max_year})",
                        value=release_date,
                        suggestions=["Verify release date is correct"]
                    ))
            else:
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=ValidationSeverity.WARNING,
                    field="release_date",
                    message=f"Could not parse release date: {release_date}",
                    value=release_date,
                    suggestions=["Use standard date format (YYYY-MM-DD)"]
                ))
                
        except Exception as e:
            logger.error(f"Error validating release date: {e}")
        
        return issues
    
    def _validate_source_id_format(self, source: str, source_id: str, rule: ValidationRule) -> List[ValidationIssue]:
        """Validate source ID format"""
        issues = []
        
        # Basic validation - source ID should not be empty
        if not source_id or not source_id.strip():
            issues.append(ValidationIssue(
                rule_id=rule.id,
                rule_name=rule.name,
                severity=rule.severity,
                field="source_id",
                message="Source ID is required",
                suggestions=["Provide a valid source ID"]
            ))
        
        # Source-specific validation
        elif source == "1001tracklists":
            # Should be numeric for 1001tracklists
            if not source_id.isdigit():
                issues.append(ValidationIssue(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    severity=ValidationSeverity.WARNING,
                    field="source_id",
                    message=f"1001tracklists source ID should be numeric: {source_id}",
                    value=source_id,
                    suggestions=["Use numeric ID from 1001tracklists"]
                ))
        
        return issues

class DuplicateDetector:
    """Detects duplicate tracks"""
    
    def __init__(self):
        self.similarity_threshold = 0.8
    
    async def detect_duplicates(self, tracks: List[TrackData]) -> List[ValidationIssue]:
        """Detect duplicate tracks in a list"""
        issues = []
        
        # Create fingerprints for each track
        fingerprints = {}
        for i, track in enumerate(tracks):
            fingerprint = self._generate_fingerprint(track)
            if fingerprint in fingerprints:
                # Found duplicate
                original_idx = fingerprints[fingerprint]
                issues.append(ValidationIssue(
                    rule_id="duplicate_detection",
                    rule_name="Duplicate Detection",
                    severity=ValidationSeverity.WARNING,
                    field=None,
                    message=f"Potential duplicate of track at index {original_idx}",
                    value=f"{track.title} - {track.artist}",
                    suggestions=["Review and remove duplicate if confirmed"]
                ))
            else:
                fingerprints[fingerprint] = i
        
        return issues
    
    def _generate_fingerprint(self, track: TrackData) -> str:
        """Generate fingerprint for duplicate detection"""
        title = (track.title or "").lower().strip()
        artist = (track.artist or "").lower().strip()
        
        # Remove common words and characters for better matching
        title = re.sub(r'\b(remix|edit|mix|extended|radio|original)\b', '', title)
        title = re.sub(r'[^\w\s]', '', title)
        title = re.sub(r'\s+', ' ', title).strip()
        
        artist = re.sub(r'[^\w\s]', '', artist)
        artist = re.sub(r'\s+', ' ', artist).strip()
        
        fingerprint_data = f"{title}|{artist}"
        return hashlib.md5(fingerprint_data.encode()).hexdigest()

# =====================
# Validation Engine
# =====================

class ValidationEngine:
    """Main validation processing engine"""
    
    def __init__(self):
        self.schema_validator = SchemaValidator()
        self.quality_validator = QualityValidator()
        self.completeness_validator = CompletenessValidator()
        self.consistency_validator = ConsistencyValidator()
        self.business_rules_validator = BusinessRulesValidator()
        self.duplicate_detector = DuplicateDetector()
    
    async def validate_task(self, task: ValidationTask) -> ValidationResult:
        """Process a validation task"""
        start_time = datetime.now()
        task.status = ValidationStatus.VALIDATING
        task.started_at = start_time
        
        # Store task status in Redis
        await self._update_task_status(task)
        
        try:
            # Convert data to list if single item
            if isinstance(task.data, TrackData):
                tracks = [task.data]
            else:
                tracks = task.data
            
            all_issues = []
            
            # Run validations based on requested types
            for validation_type in task.validation_types:
                active_validations.labels(validation_type=validation_type.value).inc()
                
                try:
                    if validation_type == ValidationType.SCHEMA:
                        for track in tracks:
                            issues = await self.schema_validator.validate(track)
                            all_issues.extend(issues)
                    
                    elif validation_type == ValidationType.QUALITY:
                        for track in tracks:
                            issues = await self.quality_validator.validate(track)
                            all_issues.extend(issues)
                    
                    elif validation_type == ValidationType.COMPLETENESS:
                        for track in tracks:
                            issues = await self.completeness_validator.validate(track)
                            all_issues.extend(issues)
                    
                    elif validation_type == ValidationType.CONSISTENCY:
                        for track in tracks:
                            issues = await self.consistency_validator.validate(track)
                            all_issues.extend(issues)
                    
                    elif validation_type == ValidationType.BUSINESS_RULES:
                        for track in tracks:
                            issues = await self.business_rules_validator.validate(track)
                            all_issues.extend(issues)
                    
                    elif validation_type == ValidationType.DUPLICATE:
                        issues = await self.duplicate_detector.detect_duplicates(tracks)
                        all_issues.extend(issues)
                    
                    validation_tasks_total.labels(
                        validation_type=validation_type.value,
                        status="success"
                    ).inc()
                    
                finally:
                    active_validations.labels(validation_type=validation_type.value).dec()
            
            # Calculate metrics
            error_count = sum(1 for issue in all_issues if issue.severity == ValidationSeverity.ERROR)
            warning_count = sum(1 for issue in all_issues if issue.severity == ValidationSeverity.WARNING)
            info_count = sum(1 for issue in all_issues if issue.severity == ValidationSeverity.INFO)
            
            # Determine if data is valid (no errors)
            is_valid = error_count == 0
            
            # Calculate quality score
            total_possible_issues = len(tracks) * len(VALIDATION_RULES)
            if total_possible_issues > 0:
                # Weight errors more heavily than warnings
                weighted_issues = error_count * 3 + warning_count * 1 + info_count * 0.5
                score = max(0.0, 1.0 - (weighted_issues / total_possible_issues))
            else:
                score = 1.0
            
            # Generate recommendations
            recommendations = self._generate_recommendations(all_issues)
            
            # Update task status
            task.status = ValidationStatus.COMPLETED
            task.completed_at = datetime.now()
            
            processing_time = (task.completed_at - start_time).total_seconds()
            
            result = ValidationResult(
                task_id=task.id,
                validation_types=task.validation_types,
                status=task.status,
                is_valid=is_valid,
                score=score,
                total_issues=len(all_issues),
                error_count=error_count,
                warning_count=warning_count,
                info_count=info_count,
                processing_time=processing_time,
                issues=all_issues,
                recommendations=recommendations
            )
            
            # Update metrics
            for validation_type in task.validation_types:
                validation_duration.labels(validation_type=validation_type.value).observe(processing_time)
                validation_results.labels(
                    validation_type=validation_type.value,
                    result="valid" if is_valid else "invalid"
                ).inc()
            
            # Store result in database
            await self._store_result(result)
            
            return result
            
        except Exception as e:
            task.status = ValidationStatus.FAILED
            task.completed_at = datetime.now()
            
            logger.error(f"Validation task {task.id} failed: {str(e)}")
            
            for validation_type in task.validation_types:
                validation_tasks_total.labels(
                    validation_type=validation_type.value,
                    status="failed"
                ).inc()
            
            result = ValidationResult(
                task_id=task.id,
                validation_types=task.validation_types,
                status=task.status,
                is_valid=False,
                score=0.0,
                total_issues=1,
                error_count=1,
                warning_count=0,
                info_count=0,
                processing_time=(task.completed_at - start_time).total_seconds(),
                issues=[ValidationIssue(
                    rule_id="system_error",
                    rule_name="System Error",
                    severity=ValidationSeverity.ERROR,
                    message=f"Validation failed: {str(e)}"
                )]
            )
            
            return result
        
        finally:
            await self._update_task_status(task)
    
    def _generate_recommendations(self, issues: List[ValidationIssue]) -> List[str]:
        """Generate recommendations based on validation issues"""
        recommendations = []
        
        # Group issues by severity
        errors = [i for i in issues if i.severity == ValidationSeverity.ERROR]
        warnings = [i for i in issues if i.severity == ValidationSeverity.WARNING]
        
        if errors:
            recommendations.append(f"Fix {len(errors)} critical errors before proceeding")
        
        if warnings:
            recommendations.append(f"Address {len(warnings)} warnings to improve data quality")
        
        # Common issue patterns
        title_issues = [i for i in issues if i.field == "title"]
        if len(title_issues) > 0:
            recommendations.append("Review title formatting and completeness")
        
        artist_issues = [i for i in issues if i.field == "artist"]
        if len(artist_issues) > 0:
            recommendations.append("Review artist name formatting and completeness")
        
        # Specific recommendations from issues
        for issue in issues[:5]:  # Top 5 issues
            if issue.suggestions:
                recommendations.extend(issue.suggestions[:1])  # Add first suggestion
        
        return list(set(recommendations))  # Remove duplicates
    
    async def _update_task_status(self, task: ValidationTask):
        """Update task status in Redis"""
        task_key = f"validation:task:{task.id}"
        redis_client.hset(task_key, mapping=task.dict())
        redis_client.expire(task_key, 86400)  # Expire after 24 hours
    
    async def _store_result(self, result: ValidationResult):
        """Store validation result in database"""
        if not db_pool:
            return
        
        try:
            async with db_pool.acquire() as conn:
                # Store validation result
                await conn.execute("""
                    INSERT INTO validation_results 
                    (task_id, validation_types, status, is_valid, score, total_issues,
                     error_count, warning_count, info_count, processing_time, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """, result.task_id, json.dumps([vt.value for vt in result.validation_types]),
                    result.status.value, result.is_valid, result.score, result.total_issues,
                    result.error_count, result.warning_count, result.info_count,
                    result.processing_time, datetime.now())
                
                # Store validation issues
                for issue in result.issues:
                    await conn.execute("""
                        INSERT INTO validation_issues
                        (task_id, rule_id, rule_name, severity, field, message, value, suggestions)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """, result.task_id, issue.rule_id, issue.rule_name, issue.severity.value,
                        issue.field, issue.message, issue.value, json.dumps(issue.suggestions))
                
        except Exception as e:
            logger.error(f"Failed to store validation result: {str(e)}")

# Initialize validation engine
validation_engine = ValidationEngine()

# =====================
# Database Initialization
# =====================

async def init_database():
    """Initialize database connection pool"""
    global db_pool
    try:
        # Set statement_cache_size=0 for PgBouncer compatibility
        db_pool = await asyncpg.create_pool(**DATABASE_CONFIG, min_size=5, max_size=20, statement_cache_size=0)
        logger.info("Database connection pool initialized")
        
        # Create tables if they don't exist
        async with db_pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS validation_results (
                    id SERIAL PRIMARY KEY,
                    task_id VARCHAR(255) NOT NULL,
                    validation_types JSONB NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    is_valid BOOLEAN NOT NULL,
                    score FLOAT NOT NULL,
                    total_issues INTEGER NOT NULL,
                    error_count INTEGER NOT NULL,
                    warning_count INTEGER NOT NULL,
                    info_count INTEGER NOT NULL,
                    processing_time FLOAT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS validation_issues (
                    id SERIAL PRIMARY KEY,
                    task_id VARCHAR(255) NOT NULL,
                    rule_id VARCHAR(100) NOT NULL,
                    rule_name VARCHAR(255) NOT NULL,
                    severity VARCHAR(20) NOT NULL,
                    field VARCHAR(100),
                    message TEXT NOT NULL,
                    value TEXT,
                    suggestions JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_validation_results_task_id ON validation_results(task_id);
                CREATE INDEX IF NOT EXISTS idx_validation_issues_task_id ON validation_issues(task_id);
                CREATE INDEX IF NOT EXISTS idx_validation_issues_severity ON validation_issues(severity);
            """)
            
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

# =====================
# Background Workers
# =====================

async def task_processor():
    """Background worker to process validation tasks from Redis queue"""
    while True:
        try:
            # Get next task from Redis queue
            task_data = redis_client.blpop("validation:queue", timeout=5)
            
            if task_data:
                task_json = task_data[1]
                task_dict = json.loads(task_json)
                task = ValidationTask(**task_dict)
                
                # Process task
                result = await validation_engine.validate_task(task)
                logger.info(f"Completed validation task {task.id}: "
                          f"valid={result.is_valid}, score={result.score:.2f}, "
                          f"issues={result.total_issues}")
            
            await asyncio.sleep(0.1)
            
        except Exception as e:
            logger.error(f"Error in validation task processor: {str(e)}")
            await asyncio.sleep(5)

# =====================
# API Endpoints
# =====================

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    await init_database()
    
    # Start background workers
    asyncio.create_task(task_processor())
    
    logger.info("Data Validator Service started")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if db_pool:
        await db_pool.close()
    logger.info("Data Validator Service stopped")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    import time
    start_time = time.time()
    
    # Check database connection
    db_status = "healthy"
    db_time = 0
    if db_pool:
        try:
            db_start = time.time()
            async with db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_time = time.time() - db_start
        except Exception as e:
            db_status = "unhealthy"
            logger.error(f"Database health check failed: {str(e)}")
    else:
        db_status = "not_initialized"
    
    # Check Redis connection
    redis_status = "healthy"
    redis_time = 0
    try:
        redis_start = time.time()
        redis_client.ping()
        redis_time = time.time() - redis_start
    except Exception as e:
        redis_status = "unhealthy"
        logger.error(f"Redis health check failed: {str(e)}")
    
    overall_status = "healthy" if db_status == "healthy" and redis_status == "healthy" else "unhealthy"
    total_time = time.time() - start_time
    
    logger.info(f"Health check completed in {total_time:.3f}s (db: {db_time:.3f}s, redis: {redis_time:.3f}s)")
    
    return {
        "status": overall_status,
        "timestamp": datetime.now().isoformat(),
        "components": {
            "database": db_status,
            "redis": redis_status
        },
        "timing": {
            "total": round(total_time, 3),
            "database": round(db_time, 3),
            "redis": round(redis_time, 3)
        }
    }

@app.post("/validate")
async def submit_validation_task(task: ValidationTask):
    """Submit a validation task"""
    # Generate task ID if not provided
    if not task.id:
        task.id = f"validate_{datetime.now().timestamp()}"
    
    task.created_at = datetime.now()
    
    # Add to Redis queue
    task_json = json.dumps(task.dict(), default=str)
    redis_client.rpush("validation:queue", task_json)
    
    # Store task metadata
    task_key = f"validation:task:{task.id}"
    redis_client.hset(task_key, mapping=task.dict())
    redis_client.expire(task_key, 86400)
    
    return {"task_id": task.id, "status": "queued"}

@app.post("/validate/sync")
async def validate_sync(task: ValidationTask):
    """Validate data synchronously"""
    if not task.id:
        task.id = f"validate_sync_{datetime.now().timestamp()}"
    
    task.created_at = datetime.now()
    
    result = await validation_engine.validate_task(task)
    return result

@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a validation task"""
    task_key = f"validation:task:{task_id}"
    task_data = redis_client.hgetall(task_key)
    
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task_data

@app.get("/tasks")
async def get_tasks(status: Optional[ValidationStatus] = None, limit: int = 100):
    """Get list of validation tasks"""
    task_keys = redis_client.keys("validation:task:*")
    tasks = []
    
    for key in task_keys[:limit]:
        task_data = redis_client.hgetall(key)
        if task_data:
            if status and task_data.get("status") != status.value:
                continue
            tasks.append(task_data)
    
    return {"tasks": tasks, "count": len(tasks)}

@app.get("/rules")
async def get_validation_rules(validation_type: Optional[ValidationType] = None):
    """Get available validation rules"""
    if validation_type:
        rules = {k: v for k, v in VALIDATION_RULES.items() 
                if v.validation_type == validation_type and v.enabled}
    else:
        rules = {k: v for k, v in VALIDATION_RULES.items() if v.enabled}
    
    return {"rules": rules}

@app.get("/stats")
async def get_validation_stats():
    """Get validation statistics"""
    if not db_pool:
        return {"error": "Database not available"}
    
    try:
        async with db_pool.acquire() as conn:
            # Get validation counts by type
            validation_counts = await conn.fetch("""
                SELECT 
                    jsonb_array_elements_text(validation_types) as validation_type,
                    COUNT(*) as count,
                    AVG(score) as avg_score
                FROM validation_results
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY validation_type
            """)
            
            # Get issue distribution
            issue_distribution = await conn.fetch("""
                SELECT severity, COUNT(*) as count
                FROM validation_issues
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY severity
            """)
            
            # Get top issues
            top_issues = await conn.fetch("""
                SELECT rule_name, COUNT(*) as count
                FROM validation_issues
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY rule_name
                ORDER BY count DESC
                LIMIT 10
            """)
            
            return {
                "validation_counts": [dict(row) for row in validation_counts],
                "issue_distribution": [dict(row) for row in issue_distribution],
                "top_issues": [dict(row) for row in top_issues]
            }
            
    except Exception as e:
        logger.error(f"Error getting validation stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(generate_latest())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)