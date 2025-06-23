#!/usr/bin/env python3
# attrition_functions.py - Helper functions for attrition score calculations
# This module contains implementations of all the functions needed for attrition score calculation
# Created to solve circular dependency issues in the main module

import logging
import re
import math
import random
from typing import List, Dict, Any, Tuple, Optional
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Add a set to track emails we've already warned about to prevent spam
_warned_emails = set()

def handle_document_not_found(email: str, db_name: str) -> None:
    """
    Handle document not found errors more gracefully with appropriate logging
    
    Args:
        email: The email of the document that wasn't found
        db_name: The database name where the document wasn't found
    """
    global _warned_emails
    
    # Only log a warning once per email to prevent log spam
    if email in _warned_emails:
        return
    
    # Add to warned emails set
    _warned_emails.add(email)
    
    # Log the warning with context
    logging.warning(f"Document not found for email: {email}")
    
    # Log what's happening to help explain why these warnings appear
    logging.info(f"This warning is normal for new employees or records that don't exist in this database.")
    
    # Limit the size of the warned emails set to prevent memory growth
    if len(_warned_emails) > 1000:
        # Clear half of the oldest entries when we reach the limit
        _warned_emails = set(list(_warned_emails)[-500:])

# These functions need to be defined here to avoid circular imports
def calculate_responsibility_mismatch(job_duties: List[str], job_title: str) -> Dict[str, Any]:
    """Calculate mismatch between responsibilities and job title/seniority"""
    from attrition_score import get_seniority_level, vector_search_responsibilities
    
    # Default values if no data
    if not job_duties or not job_title:
        return {
            "mismatch_score": 0.5,
            "explanation": "Insufficient data to calculate responsibility mismatch"
        }
    
    # Get seniority level from job title
    seniority_level = get_seniority_level(job_title)
    
    # Analyze responsibilities - ensure we only join string items
    # Convert any non-string items to strings
    str_duties = []
    for duty in job_duties:
        if isinstance(duty, str):
            str_duties.append(duty)
        elif isinstance(duty, dict) and "description" in duty:
            str_duties.append(str(duty["description"]))
        elif isinstance(duty, dict) and "title" in duty:
            str_duties.append(str(duty["title"]))
        elif isinstance(duty, dict):
            # Just use the first value in the dict
            try:
                str_duties.append(str(next(iter(duty.values()))))
            except (StopIteration, AttributeError):
                pass  # Skip this duty if we can't get a string
        else:
            try:
                str_duties.append(str(duty))
            except Exception:
                pass  # Skip this duty if we can't convert it to a string
    
    # Join the string duties
    responsibility_text = " ".join(str_duties)
    
    # Use vector search to determine responsibility types
    resp_distribution = vector_search_responsibilities(responsibility_text)
    
    # Calculate expected distribution based on seniority
    expected_distribution = {}
    
    if seniority_level <= 0.3:  # Junior
        expected_distribution = {
            "management": 0.1,
            "technical_leadership": 0.2,
            "execution": 0.7
        }
    elif seniority_level <= 0.6:  # Mid-level to Senior
        expected_distribution = {
            "management": 0.3,
            "technical_leadership": 0.4,
            "execution": 0.3
        }
    else:  # Director and above
        expected_distribution = {
            "management": 0.6,
            "technical_leadership": 0.3,
            "execution": 0.1
        }
    
    # Calculate mismatch score (0 = perfect match, 1 = complete mismatch)
    mismatch = 0
    for resp_type in resp_distribution:
        if resp_type in expected_distribution:
            mismatch += abs(resp_distribution[resp_type] - expected_distribution[resp_type])
    
    # Normalize to 0-1 range (divide by 2 because sum of absolute differences can be up to 2)
    mismatch_score = min(1.0, mismatch / 2.0)
    
    # Generate explanation
    if mismatch_score > 0.6:
        if resp_distribution.get("management", 0) > expected_distribution.get("management", 0) + 0.2:
            explanation = "Too many management responsibilities for seniority level"
        elif resp_distribution.get("execution", 0) > expected_distribution.get("execution", 0) + 0.2:
            explanation = "Too many execution tasks for seniority level"
        else:
            explanation = "Significant mismatch between responsibilities and seniority level"
    elif mismatch_score > 0.3:
        explanation = "Some mismatch between responsibilities and seniority level"
    else:
        explanation = "Responsibilities align well with seniority level"
    
    return {
        "mismatch_score": mismatch_score,
        "explanation": explanation,
        "responsibility_distribution": resp_distribution,
        "expected_distribution": expected_distribution,
        "seniority_level": seniority_level
    }

def calculate_tenure_factor(time_with_company_months: int, time_in_role_months: int) -> Dict[str, Any]:
    """Calculate tenure-based attrition risk"""
    from attrition_score import TENURE_RISK_THRESHOLDS
    
    # Default values if no data
    if time_with_company_months <= 0:
        return {
            "tenure_score": 0.5,
            "explanation": "Insufficient tenure data"
        }
    
    # Calculate basic tenure risk based on common patterns
    # Risk is higher at certain tenure milestones
    
    # Initial honeymoon period (low risk)
    if time_with_company_months < TENURE_RISK_THRESHOLDS["honeymoon_end"]:
        base_risk = 0.2
        explanation = "Still in initial honeymoon period"
    
    # Assessment period (moderate risk)
    elif time_with_company_months < TENURE_RISK_THRESHOLDS["assessment_period"]:
        base_risk = 0.4
        explanation = "In assessment period where employees evaluate long-term fit"
    
    # Growth plateau (higher risk)
    elif time_with_company_months < TENURE_RISK_THRESHOLDS["growth_plateau"]:
        base_risk = 0.6
        explanation = "Approaching potential growth plateau"
    
    # Significant milestone (high risk)
    elif time_with_company_months < TENURE_RISK_THRESHOLDS["significant_milestone"]:
        base_risk = 0.7
        explanation = "Nearing significant tenure milestone, may reassess career"
    
    # Long tenure (variable risk)
    else:
        # Long tenure can go either way - some get comfortable, others seek change
        base_risk = 0.5
        explanation = "Long tenure may indicate comfort or potential stagnation"
    
    # Adjust for time in current role
    role_factor = 0
    
    if time_in_role_months > 0:
        # Calculate ratio of time in role to total time
        role_ratio = time_in_role_months / time_with_company_months
        
        # If they've been in the same role for most of their tenure, higher risk
        if role_ratio > 0.8 and time_with_company_months > 24:
            role_factor = 0.2
            explanation += "; long time in same role may indicate stagnation"
        # If they've been recently promoted, lower risk
        elif role_ratio < 0.3 and time_with_company_months > 12:
            role_factor = -0.2
            explanation += "; recent role change may indicate growth opportunities"
    
    # Calculate final score
    tenure_score = min(1.0, max(0.0, base_risk + role_factor))
    
    return {
        "tenure_score": tenure_score,
        "explanation": explanation,
        "time_with_company_months": time_with_company_months,
        "time_in_role_months": time_in_role_months
    }

def calculate_utilization_factor(utilization_assessment: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate attrition risk based on utilization patterns"""
    # Default values if no data
    if not utilization_assessment or not isinstance(utilization_assessment, dict):
        return {
            "utilization_attrition_score": 0.5,
            "explanation": "Insufficient utilization data"
        }
    
    # Extract utilization score if available
    utilization_score = utilization_assessment.get("utilization_score", 0.5)
    
    # Convert to float if it's a string
    if isinstance(utilization_score, str):
        try:
            utilization_score = float(utilization_score)
        except ValueError:
            utilization_score = 0.5
    
    # Ensure it's in 0-1 range
    utilization_score = min(1.0, max(0.0, utilization_score))
    
    # Calculate attrition risk based on utilization
    # Both under and over-utilization increase risk
    if utilization_score < 0.3:
        # Severe under-utilization
        attrition_score = 0.8
        explanation = "Severe under-utilization may indicate lack of engagement"
    elif utilization_score < 0.6:
        # Moderate under-utilization
        attrition_score = 0.6
        explanation = "Under-utilization may lead to boredom and seeking new challenges"
    elif utilization_score <= 0.8:
        # Optimal utilization
        attrition_score = 0.3
        explanation = "Healthy utilization level supports retention"
    elif utilization_score <= 0.9:
        # High but manageable utilization
        attrition_score = 0.4
        explanation = "High job intensity may be sustainable with proper support"
    else:
        # Over-utilization
        attrition_score = 0.7
        explanation = "Over-utilization may lead to burnout and seeking less demanding role"
    
    # Consider other factors if available
    if "burnout_risk" in utilization_assessment:
        burnout_risk = utilization_assessment["burnout_risk"]
        if isinstance(burnout_risk, (int, float)) and burnout_risk > 0.6:
            attrition_score = max(attrition_score, 0.7)
            explanation += "; high burnout risk detected"
    
    return {
        "utilization_attrition_score": attrition_score,
        "explanation": explanation,
        "utilization_score": utilization_score
    }

def calculate_seniority_factor(job_title: str) -> Dict[str, Any]:
    """Calculate attrition risk based on seniority level"""
    from attrition_score import get_seniority_level, SENIORITY_ATTRITION_RISK
    
    # Get seniority level
    seniority_level = get_seniority_level(job_title)
    
    # Get attrition risk for this seniority level
    if seniority_level in SENIORITY_ATTRITION_RISK:
        attrition_score = SENIORITY_ATTRITION_RISK[seniority_level]
    else:
        # Find closest seniority level
        closest_level = min(SENIORITY_ATTRITION_RISK.keys(), key=lambda x: abs(x - seniority_level))
        attrition_score = SENIORITY_ATTRITION_RISK[closest_level]
    
    # Generate explanation
    if seniority_level <= 0.2:
        explanation = "Junior employees typically building experience before moving"
    elif seniority_level <= 0.4:
        explanation = "Mid-level employees often seeking advancement opportunities"
    elif seniority_level <= 0.6:
        explanation = "Senior employees with marketable skills and growth expectations"
    elif seniority_level <= 0.8:
        explanation = "Leadership roles with more selective job changes"
    else:
        explanation = "Executive positions with lower turnover rates"
    
    return {
        "seniority_attrition_score": attrition_score,
        "explanation": explanation,
        "seniority_level": seniority_level
    }

def calculate_task_variety_index(job_duties: List[str], projects: List[Any], tools: List[str]) -> Dict[str, Any]:
    """Calculate task variety and its impact on attrition risk"""
    # Default values if no data
    if not job_duties and not projects and not tools:
        return {
            "variety_score": 0.5,
            "attrition_risk": 0.5,
            "explanation": "Insufficient data to calculate task variety"
        }
    
    # Calculate variety metrics - make sure we count items properly
    # For job_duties, check if it's a valid list and handle complex structures
    if isinstance(job_duties, list):
        # Count actual duties, handling different possible formats
        valid_duties = 0
        for duty in job_duties:
            if duty:  # Check if not empty/None
                valid_duties += 1
        duty_count = valid_duties
    else:
        duty_count = 0
    
    # For projects, handle potential complex structures
    if isinstance(projects, list):
        # Count valid projects
        project_count = len([p for p in projects if p])
    else:
        project_count = 0
    
    # For tools, ensure we count valid tools
    if isinstance(tools, list):
        tool_count = len([t for t in tools if t])
    else:
        tool_count = 0
    
    # Calculate weighted variety score
    variety_score = 0
    total_weight = 0
    
    if duty_count > 0:
        duty_variety = min(1.0, duty_count / 10)  # Cap at 10 duties
        variety_score += duty_variety * 0.4
        total_weight += 0.4
    
    if project_count > 0:
        project_variety = min(1.0, project_count / 5)  # Cap at 5 projects
        variety_score += project_variety * 0.4
        total_weight += 0.4
    
    if tool_count > 0:
        tool_variety = min(1.0, tool_count / 8)  # Cap at 8 tools
        variety_score += tool_variety * 0.2
        total_weight += 0.2
    
    # Normalize score
    if total_weight > 0:
        variety_score = variety_score / total_weight
    else:
        variety_score = 0.5  # Default if no data
    
    # Calculate attrition risk based on variety
    # Both too little and too much variety can increase risk
    if variety_score < 0.3:
        attrition_risk = 0.7
        explanation = "Low task variety may lead to boredom and seeking more diverse work"
    elif variety_score < 0.6:
        attrition_risk = 0.5
        explanation = "Moderate task variety provides some engagement"
    elif variety_score <= 0.8:
        attrition_risk = 0.3
        explanation = "Healthy task variety supports engagement and retention"
    else:
        attrition_risk = 0.5
        explanation = "Very high task variety may indicate scattered focus or overload"
    
    return {
        "variety_score": variety_score,
        "attrition_risk": attrition_risk,
        "explanation": explanation,
        "duty_count": duty_count,
        "project_count": project_count,
        "tool_count": tool_count
    }

def calculate_job_intensity_factor(job_intensity_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate attrition risk based on job intensity"""
    # Default values if no data
    if not job_intensity_analysis or not isinstance(job_intensity_analysis, dict):
        return {
            "intensity_attrition_score": 0.5,
            "explanation": "Insufficient job intensity data"
        }
    
    # Extract intensity score if available
    intensity_score = job_intensity_analysis.get("intensity_score", 0.5)
    
    # Convert to float if it's a string
    if isinstance(intensity_score, str):
        try:
            intensity_score = float(intensity_score)
        except ValueError:
            intensity_score = 0.5
    
    # Ensure it's in 0-1 range
    intensity_score = min(1.0, max(0.0, intensity_score))
    
    # Calculate attrition risk based on intensity
    if intensity_score < 0.3:
        # Low intensity
        attrition_score = 0.6
        explanation = "Low job intensity may lead to boredom and seeking more challenge"
    elif intensity_score < 0.6:
        # Moderate intensity
        attrition_score = 0.3
        explanation = "Healthy job intensity supports engagement and retention"
    elif intensity_score <= 0.8:
        # High intensity
        attrition_score = 0.5
        explanation = "High job intensity may be sustainable with proper support"
    else:
        # Very high intensity
        attrition_score = 0.8
        explanation = "Very high job intensity may lead to burnout and seeking less demanding role"
    
    # Consider other factors if available
    if "stress_level" in job_intensity_analysis:
        stress_level = job_intensity_analysis["stress_level"]
        if isinstance(stress_level, (int, float)) and stress_level > 0.7:
            attrition_score = max(attrition_score, 0.7)
            explanation += "; high stress level detected"
    
    return {
        "intensity_attrition_score": attrition_score,
        "explanation": explanation,
        "intensity_score": intensity_score
    }

def calculate_role_project_ratio(projects: List[Any], seniority_level: float) -> Dict[str, Any]:
    """Calculate attrition risk based on project count vs. seniority level"""
    from attrition_score import EXPECTED_PROJECTS_BY_SENIORITY
    
    # Default values if no data
    if not projects or not isinstance(projects, list):
        return {
            "role_project_attrition_score": 0.5,
            "explanation": "Insufficient project data"
        }
    
    # Count projects
    project_count = len(projects)
    
    # Get expected project count for this seniority level
    # Find closest seniority level
    closest_level = min(EXPECTED_PROJECTS_BY_SENIORITY.keys(), key=lambda x: abs(x - seniority_level))
    expected_projects = EXPECTED_PROJECTS_BY_SENIORITY[closest_level]
    
    # Calculate ratio of actual to expected
    if expected_projects > 0:
        project_ratio = project_count / expected_projects
    else:
        project_ratio = 1.0  # Default if no expectation
    
    # Calculate attrition risk based on ratio
    if project_ratio < 0.5:
        # Far fewer projects than expected
        attrition_score = 0.7
        explanation = "Significantly fewer projects than expected for seniority level"
    elif project_ratio < 0.8:
        # Somewhat fewer projects
        attrition_score = 0.6
        explanation = "Fewer projects than expected for seniority level"
    elif project_ratio <= 1.2:
        # About right
        attrition_score = 0.3
        explanation = "Project load aligns well with seniority level"
    elif project_ratio <= 1.5:
        # Somewhat more projects
        attrition_score = 0.5
        explanation = "More projects than typical for seniority level"
    else:
        # Far more projects
        attrition_score = 0.8
        explanation = "Significantly more projects than expected for seniority level"
    
    return {
        "role_project_attrition_score": attrition_score,
        "explanation": explanation,
        "project_count": project_count,
        "expected_projects": expected_projects,
        "project_ratio": project_ratio
    }

def calculate_collaboration_factor(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate collaboration index and its impact on attrition risk"""
    from attrition_score import calculate_collaboration_index
    
    # Try to get structured collaboration analysis first
    if "collaboration_analysis" in doc and isinstance(doc["collaboration_analysis"], dict):
        collab_analysis = doc["collaboration_analysis"]
        
        # If it already has an attrition score, use it
        if "attrition_score" in collab_analysis:
            return {
                "collaboration_attrition_score": collab_analysis["attrition_score"],
                "explanation": collab_analysis.get("explanation", "Based on collaboration analysis"),
                "collaboration_score": collab_analysis.get("collaboration_score", 0.5)
            }
    
    # Fall back to calculating from feedback data
    feedback_given = doc.get("feedbackGiven", [])
    feedback_received = doc.get("feedbackReceived", [])
    
    return calculate_collaboration_index(feedback_given, feedback_received)

def calculate_salary_satisfaction(salary: float, job_title: str, work_mode: str, 
                                 location: str, industry: str, doc: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate salary satisfaction and its impact on attrition risk"""
    from attrition_score import get_seniority_level, get_col_for_location
    from attrition_score import SALARY_EXPECTATIONS_BY_SENIORITY, WORK_MODE_FACTORS, INDUSTRY_SALARY_FACTORS
    
    # Default values if no data
    if not salary or salary <= 0:
        return {
            "salary_score": 0.5,
            "explanation": "Insufficient salary data"
        }
    
    # Get seniority level
    seniority_level = get_seniority_level(job_title)
    
    # Find closest seniority level in expectations table
    closest_level = min(SALARY_EXPECTATIONS_BY_SENIORITY.keys(), key=lambda x: abs(x - seniority_level))
    expected_factor = SALARY_EXPECTATIONS_BY_SENIORITY[closest_level]
    
    # Get location factor
    location_factor = get_col_for_location(location)
    
    # Get work mode factor
    work_mode_factor = 1.0  # Default
    if work_mode and isinstance(work_mode, str):
        work_mode_lower = work_mode.lower().strip()
        for mode, factor in WORK_MODE_FACTORS.items():
            if mode in work_mode_lower:
                work_mode_factor = factor
                break
    
    # Get industry factor
    industry_factor = 1.0  # Default
    if industry and isinstance(industry, str):
        industry_lower = industry.lower().strip()
        for ind, factor in INDUSTRY_SALARY_FACTORS.items():
            if ind in industry_lower:
                industry_factor = factor
                break
    
    # Calculate expected salary range
    # This is a simplified model - in reality would need more data points
    base_salary = 75000  # Arbitrary baseline for mid-level
    
    expected_salary = base_salary * expected_factor * location_factor * work_mode_factor * industry_factor
    
    # Calculate ratio of actual to expected
    if expected_salary > 0:
        salary_ratio = salary / expected_salary
    else:
        salary_ratio = 1.0  # Default if no expectation
    
    # Calculate satisfaction score based on ratio
    if salary_ratio < 0.7:
        # Significantly underpaid
        satisfaction_score = 0.2
        attrition_score = 0.8
        explanation = "Salary significantly below market expectations"
    elif salary_ratio < 0.9:
        # Somewhat underpaid
        satisfaction_score = 0.4
        attrition_score = 0.7
        explanation = "Salary below market expectations"
    elif salary_ratio <= 1.1:
        # About right
        satisfaction_score = 0.7
        attrition_score = 0.3
        explanation = "Salary aligns with market expectations"
    elif salary_ratio <= 1.3:
        # Somewhat overpaid
        satisfaction_score = 0.9
        attrition_score = 0.2
        explanation = "Salary above market expectations"
    else:
        # Significantly overpaid
        satisfaction_score = 1.0
        attrition_score = 0.1
        explanation = "Salary significantly above market expectations"
    
    # Check for recent compensation changes
    if "compensationHistory" in doc and isinstance(doc["compensationHistory"], list):
        comp_history = doc["compensationHistory"]
        if comp_history and len(comp_history) >= 2:
            # Sort by date if available
            try:
                sorted_history = sorted(comp_history, 
                                       key=lambda x: x.get("date", ""),
                                       reverse=True)
                
                latest = sorted_history[0].get("amount", 0)
                previous = sorted_history[1].get("amount", 0)
                
                if latest > 0 and previous > 0:
                    change_pct = (latest - previous) / previous
                    
                    if change_pct >= 0.1:  # 10% or more increase
                        # Recent significant raise improves retention
                        attrition_score = max(0.1, attrition_score - 0.2)
                        explanation += "; recent significant compensation increase"
            except (KeyError, TypeError, ValueError):
                pass  # Skip if there's an issue with the history
    
    return {
        "salary_score": attrition_score,
        "explanation": explanation,
        "satisfaction_score": satisfaction_score,
        "salary_ratio": salary_ratio,
        "expected_salary": expected_salary
    } 