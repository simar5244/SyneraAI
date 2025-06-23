from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database import get_db
from ..models.models import Layout, Role, Connection
from ..auth import get_current_user, User
from ..utils.workload import build_org_graph, calculate_workload, calculate_hierarchy_depth

router = APIRouter()

@router.get("/{layout_id}/analyze", response_model=Dict[str, Any])
async def analyze_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform detailed analysis on an organization layout.
    Calculates metrics like total workload, average span of control,
    and identifies roles with excessive workload or span of control.
    """
    # Check if layout exists
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout with id {layout_id} not found"
        )
    
    # Check permission
    is_owner = layout.created_by == current_user.id
    is_public = layout.is_public
    is_admin = current_user.role in ["admin", "eco"]
    
    if not (is_owner or is_public or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this layout"
        )
    
    # Get all roles in this layout
    roles = db.query(Role).filter(Role.layout_id == layout_id).all()
    if not roles:
        return {
            "layout_id": layout_id,
            "name": layout.name,
            "status": "empty",
            "message": "Layout has no roles to analyze"
        }
    
    # Build the graph for analysis
    G = build_org_graph(db, layout_id)
    
    # Calculate workload and depth for each role
    role_analysis = []
    total_workload = 0
    max_depth = 0
    spans_of_control = []
    
    for role in roles:
        workload = calculate_workload(G, role.id)
        depth = calculate_hierarchy_depth(G, role.id)
        
        # Count direct reports (span of control)
        direct_reports = list(G.successors(role.id)) if role.id in G else []
        span_of_control = len(direct_reports)
        
        if span_of_control > 0:
            spans_of_control.append(span_of_control)
        
        total_workload += workload
        max_depth = max(max_depth, depth)
        
        # Get manager name
        managers = list(G.predecessors(role.id)) if role.id in G else []
        manager_role = None
        if managers:
            manager_id = managers[0]
            manager_role = next((r for r in roles if r.id == manager_id), None)
        
        role_analysis.append({
            "id": role.id,
            "name": role.name,
            "workload": workload,
            "hierarchy_depth": depth,
            "span_of_control": span_of_control,
            "direct_reports": direct_reports,
            "manager_id": manager_role.id if manager_role else None,
            "manager_name": manager_role.name if manager_role else None,
            "has_excessive_workload": workload > 10,  # Threshold for high workload
            "has_excessive_span": span_of_control > 7  # Threshold for span of control
        })
    
    # Calculate metrics
    avg_workload = total_workload / len(roles) if roles else 0
    avg_span = sum(spans_of_control) / len(spans_of_control) if spans_of_control else 0
    
    # Identify roles with issues
    excessive_workload_roles = [r for r in role_analysis if r["has_excessive_workload"]]
    excessive_span_roles = [r for r in role_analysis if r["has_excessive_span"]]
    
    # Identify bottlenecks (roles with high workload and high span)
    bottlenecks = [r for r in role_analysis if r["has_excessive_workload"] and r["has_excessive_span"]]
    
    # Identify isolated roles (no connections)
    isolated_roles = [r for r in role_analysis if not r["direct_reports"] and not r["manager_id"]]
    
    return {
        "layout_id": layout_id,
        "name": layout.name,
        "total_roles": len(roles),
        "metrics": {
            "total_workload": total_workload,
            "average_workload": avg_workload,
            "max_hierarchy_depth": max_depth,
            "average_span_of_control": avg_span
        },
        "issues": {
            "excessive_workload_count": len(excessive_workload_roles),
            "excessive_span_count": len(excessive_span_roles),
            "bottleneck_count": len(bottlenecks),
            "isolated_role_count": len(isolated_roles)
        },
        "roles_with_excessive_workload": excessive_workload_roles,
        "roles_with_excessive_span": excessive_span_roles,
        "bottlenecks": bottlenecks,
        "isolated_roles": isolated_roles,
        "role_analysis": sorted(role_analysis, key=lambda x: x["workload"], reverse=True)
    }

@router.get("/{layout_id}/optimize-suggestions", response_model=Dict[str, Any])
async def optimize_layout_suggestions(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate suggestions for optimizing an organization layout.
    Suggests role redistributions, organizational restructuring, 
    and reporting line changes to improve efficiency.
    """
    # First get the layout analysis
    analysis = await analyze_layout(layout_id, db, current_user)
    
    suggestions = []
    
    # Suggest solutions for excessive workload
    for role in analysis["roles_with_excessive_workload"]:
        # Get direct reports to suggest redistribution
        if role["direct_reports"]:
            suggestions.append({
                "issue_type": "excessive_workload",
                "role_id": role["id"],
                "role_name": role["name"],
                "current_workload": role["workload"],
                "suggestion": f"Redistribute work from {role['name']} by transferring some direct reports to other managers",
                "potential_actions": [
                    {
                        "action": "redistribute_reports",
                        "details": f"Consider moving some of the {len(role['direct_reports'])} direct reports to other managers or creating a new mid-level manager"
                    },
                    {
                        "action": "create_assistant",
                        "details": f"Create an assistant role to support {role['name']} with administrative tasks"
                    }
                ]
            })
        else:
            suggestions.append({
                "issue_type": "excessive_workload",
                "role_id": role["id"],
                "role_name": role["name"],
                "current_workload": role["workload"],
                "suggestion": f"Reduce workload for {role['name']} by splitting responsibilities",
                "potential_actions": [
                    {
                        "action": "split_role",
                        "details": f"Consider splitting this role into multiple specialized roles"
                    },
                    {
                        "action": "add_support",
                        "details": f"Add a support role to handle part of the workload"
                    }
                ]
            })
    
    # Suggest solutions for excessive span of control
    for role in analysis["roles_with_excessive_span"]:
        suggestions.append({
            "issue_type": "excessive_span",
            "role_id": role["id"],
            "role_name": role["name"],
            "current_span": role["span_of_control"],
            "suggestion": f"Reduce span of control for {role['name']} by introducing mid-level management",
            "potential_actions": [
                {
                    "action": "add_middle_management",
                    "details": f"Introduce team lead roles to manage groups of the current {role['span_of_control']} direct reports"
                },
                {
                    "action": "reorganize_teams",
                    "details": "Group direct reports into functional teams with team leads"
                }
            ]
        })
    
    # Suggest solutions for bottlenecks (both high workload and high span)
    for role in analysis["bottlenecks"]:
        suggestions.append({
            "issue_type": "bottleneck",
            "role_id": role["id"],
            "role_name": role["name"],
            "current_workload": role["workload"],
            "current_span": role["span_of_control"],
            "suggestion": f"Critical bottleneck: {role['name']} has both high workload and too many direct reports",
            "potential_actions": [
                {
                    "action": "urgent_restructure",
                    "details": "Immediately restructure by adding middle management and redistributing responsibilities"
                },
                {
                    "action": "delegate_authority",
                    "details": "Delegate decision-making authority to team leads to reduce bottlenecks"
                },
                {
                    "action": "assistant_and_team_leads",
                    "details": "Add both an executive assistant and team leads to address both workload and span issues"
                }
            ],
            "priority": "high"
        })
    
    # Suggest solutions for isolated roles
    for role in analysis["isolated_roles"]:
        suggestions.append({
            "issue_type": "isolated_role",
            "role_id": role["id"],
            "role_name": role["name"],
            "suggestion": f"Connect isolated role: {role['name']} has no reporting lines",
            "potential_actions": [
                {
                    "action": "establish_reporting_line",
                    "details": "Establish a clear reporting relationship for this role"
                },
                {
                    "action": "evaluate_necessity",
                    "details": "Evaluate if this role is necessary or could be merged with another"
                }
            ]
        })
    
    # Suggest general optimizations based on metrics
    if analysis["metrics"]["average_span_of_control"] > 5:
        suggestions.append({
            "issue_type": "organizational",
            "suggestion": "Organization is too flat with high average span of control",
            "metrics": {
                "avg_span": analysis["metrics"]["average_span_of_control"]
            },
            "potential_actions": [
                {
                    "action": "add_hierarchy_levels",
                    "details": "Add additional levels of management to reduce the average span of control"
                }
            ]
        })
    
    if analysis["metrics"]["max_hierarchy_depth"] > 6:
        suggestions.append({
            "issue_type": "organizational",
            "suggestion": "Organization is too hierarchical with many levels",
            "metrics": {
                "max_depth": analysis["metrics"]["max_hierarchy_depth"]
            },
            "potential_actions": [
                {
                    "action": "flatten_hierarchy",
                    "details": "Consider flattening the organization by removing unnecessary management layers"
                }
            ]
        })
    
    # Order suggestions by priority
    prioritized_suggestions = sorted(
        suggestions,
        key=lambda x: (
            0 if x.get("issue_type") == "bottleneck" else
            1 if x.get("issue_type") == "excessive_workload" else
            2 if x.get("issue_type") == "excessive_span" else
            3 if x.get("issue_type") == "organizational" else
            4
        )
    )
    
    return {
        "layout_id": layout_id,
        "layout_name": analysis["name"],
        "total_suggestions": len(prioritized_suggestions),
        "analysis_summary": {
            "total_roles": analysis["total_roles"],
            "roles_with_excessive_workload": len(analysis["roles_with_excessive_workload"]),
            "roles_with_excessive_span": len(analysis["roles_with_excessive_span"]),
            "bottlenecks": len(analysis["bottlenecks"]),
            "isolated_roles": len(analysis["isolated_roles"])
        },
        "optimization_suggestions": prioritized_suggestions
    }

@router.get("/{layout_id}/health-score", response_model=Dict[str, Any])
async def calculate_organization_health(
    layout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Calculate an overall health score for the organization layout.
    Considers factors like workload distribution, span of control,
    hierarchy depth, and role connectivity.
    """
    # First get the layout analysis
    analysis = await analyze_layout(layout_id, db, current_user)
    
    # Calculate health metrics
    
    # 1. Workload distribution health (0-100)
    # Lower score if there's high variance in workload or many overloaded roles
    workload_scores = [role["workload"] for role in analysis["role_analysis"]]
    max_workload = max(workload_scores) if workload_scores else 0
    avg_workload = analysis["metrics"]["average_workload"]
    
    # Calculate variance in workload
    workload_variance = sum((w - avg_workload) ** 2 for w in workload_scores) / len(workload_scores) if workload_scores else 0
    
    # Percentage of roles with excessive workload
    pct_excessive_workload = (len(analysis["roles_with_excessive_workload"]) / analysis["total_roles"]) * 100 if analysis["total_roles"] > 0 else 0
    
    # Workload health score - penalize high variance and excessive workload
    workload_health = 100 - min(100, (workload_variance / 5) + pct_excessive_workload * 2)
    
    # 2. Span of control health (0-100)
    # Ideal span is 4-7, penalize for too low or too high
    span_scores = [role["span_of_control"] for role in analysis["role_analysis"] if role["span_of_control"] > 0]
    avg_span = analysis["metrics"]["average_span_of_control"]
    
    # Calculate how far the average span is from the ideal range (4-7)
    span_deviation = 0
    if avg_span < 4:
        span_deviation = 4 - avg_span
    elif avg_span > 7:
        span_deviation = avg_span - 7
    
    # Percentage of roles with excessive span
    pct_excessive_span = (len(analysis["roles_with_excessive_span"]) / analysis["total_roles"]) * 100 if analysis["total_roles"] > 0 else 0
    
    # Span health score - penalize deviation from ideal and excessive span
    span_health = 100 - min(100, (span_deviation * 10) + pct_excessive_span * 1.5)
    
    # 3. Hierarchy depth health (0-100)
    # Ideal max depth is 3-5 levels, penalize for too shallow or too deep
    max_depth = analysis["metrics"]["max_hierarchy_depth"]
    
    depth_deviation = 0
    if max_depth < 3 and analysis["total_roles"] > 10:
        # Only penalize shallow hierarchies if there are enough roles to justify more levels
        depth_deviation = 3 - max_depth
    elif max_depth > 5:
        depth_deviation = max_depth - 5
    
    # Hierarchy health score - penalize deviation from ideal
    hierarchy_health = 100 - min(100, depth_deviation * 15)
    
    # 4. Bottleneck health (0-100)
    # Penalize for bottlenecks
    pct_bottlenecks = (len(analysis["bottlenecks"]) / analysis["total_roles"]) * 100 if analysis["total_roles"] > 0 else 0
    bottleneck_health = 100 - min(100, pct_bottlenecks * 5)  # Each bottleneck severely impacts health
    
    # 5. Isolation health (0-100)
    # Penalize for isolated roles
    pct_isolated = (len(analysis["isolated_roles"]) / analysis["total_roles"]) * 100 if analysis["total_roles"] > 0 else 0
    isolation_health = 100 - min(100, pct_isolated * 10)
    
    # Overall health score (weighted average)
    overall_health = (
        workload_health * 0.3 +
        span_health * 0.25 +
        hierarchy_health * 0.15 +
        bottleneck_health * 0.2 +
        isolation_health * 0.1
    )
    
    # Health grade based on score
    health_grade = "A+" if overall_health >= 95 else \
                  "A" if overall_health >= 90 else \
                  "A-" if overall_health >= 85 else \
                  "B+" if overall_health >= 80 else \
                  "B" if overall_health >= 75 else \
                  "B-" if overall_health >= 70 else \
                  "C+" if overall_health >= 65 else \
                  "C" if overall_health >= 60 else \
                  "C-" if overall_health >= 55 else \
                  "D+" if overall_health >= 50 else \
                  "D" if overall_health >= 45 else \
                  "D-" if overall_health >= 40 else "F"
    
    # Generate key insights
    insights = []
    
    if workload_health < 70:
        insights.append("Workload distribution needs improvement - too many overloaded roles")
    
    if span_health < 70:
        if avg_span > 7:
            insights.append("Span of control is too high - consider adding middle management")
        else:
            insights.append("Span of control is too low - consider flattening the hierarchy")
    
    if hierarchy_health < 70:
        if max_depth > 5:
            insights.append("Organization is too hierarchical - consider removing layers")
        else:
            insights.append("Organization may be too flat for its size - consider adding structure")
    
    if bottleneck_health < 70:
        insights.append("Critical bottlenecks exist that could severely impact efficiency")
    
    if isolation_health < 70:
        insights.append("Too many isolated roles without clear reporting lines")
    
    return {
        "layout_id": layout_id,
        "layout_name": analysis["name"],
        "total_roles": analysis["total_roles"],
        "health_score": round(overall_health, 1),
        "health_grade": health_grade,
        "component_scores": {
            "workload_health": round(workload_health, 1),
            "span_health": round(span_health, 1),
            "hierarchy_health": round(hierarchy_health, 1),
            "bottleneck_health": round(bottleneck_health, 1),
            "isolation_health": round(isolation_health, 1)
        },
        "key_insights": insights,
        "issues_summary": {
            "roles_with_excessive_workload": len(analysis["roles_with_excessive_workload"]),
            "roles_with_excessive_span": len(analysis["roles_with_excessive_span"]),
            "bottlenecks": len(analysis["bottlenecks"]),
            "isolated_roles": len(analysis["isolated_roles"])
        }
    } 