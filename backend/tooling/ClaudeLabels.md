# Claude-Curated Cluster Labels

This document describes the process for manually curating cluster labels for better interpretability of the scientific paper visualization.

## Overview

While automated TF-IDF-based cluster labeling (stored in `cluster_label`) provides data-driven labels, they can sometimes be generic or unclear. The `claude_label` column contains human-curated labels that are:

- More descriptive and specific
- Domain-appropriate in terminology
- Free from generic keywords like "Evidence," "Data," "High"
- Better reflecting actual research focus

## Process for Creating Claude Labels

### 1. Query Existing Clusters

First, get an overview of all clusters with their automated labels:

```sql
SELECT cluster_id, cluster_label, COUNT(*) as count
FROM papers
WHERE cluster_id IS NOT NULL
GROUP BY cluster_id, cluster_label
ORDER BY cluster_id;
```

### 2. Sample Papers from Each Cluster

For each cluster, examine sample papers to understand the actual content:

```sql
SELECT cluster_id, title, field_subfield
FROM papers
WHERE cluster_id = <CLUSTER_ID> AND title IS NOT NULL
LIMIT 5;
```

### 3. Analyze Content Patterns

Look for:

- **Common research domains** (from `field_subfield`)
- **Methodological approaches** (from titles and summaries)
- **Specific topics or themes** that unite the papers
- **Key terminology** that distinguishes this cluster

### 4. Create Descriptive Labels

Good cluster labels should:

- Be 3-7 words long
- Use domain-specific terminology
- Combine related concepts with "&" or "and"
- Avoid vague terms like "Studies," "Analysis," "Research"
- Be specific enough to distinguish from other clusters

**Examples:**

- ❌ Bad: "Data, Model, Validation"
- ✅ Good: "Model Validation & Data Analysis"

- ❌ Bad: "Health, Social, Higher"
- ✅ Good: "Social Determinants of Health"

- ❌ Bad: "Mol, Kcal Mol, Kcal"
- ✅ Good: "Computational Chemistry & Quantum Calculations"

### 5. Add Column and Update Database

Add the `claude_label` column if it doesn't exist:

```sql
ALTER TABLE papers ADD COLUMN claude_label TEXT;
```

Create a SQL script (`update_claude_labels.sql`) with UPDATE statements:

```sql
UPDATE papers SET claude_label = 'Geology & Paleoclimatology' WHERE cluster_id = 0;
UPDATE papers SET claude_label = 'Water Resources & Environmental Hydrology' WHERE cluster_id = 1;
-- ... (one for each cluster)
```

Execute the script:

```bash
sqlite3 data/db.sqlite < tooling/update_claude_labels.sql
```

### 6. Verify Updates

Check that labels were applied correctly:

```sql
SELECT cluster_id, claude_label, COUNT(*)
FROM papers
WHERE cluster_id IN (0,1,2,3,4)
GROUP BY cluster_id, claude_label;
```

## Using Claude Labels in the Application

### Backend (API)

Update `api/models.py` to include `claude_label`:

```python
class PaperSummary(BaseModel):
    # ... existing fields ...
    claude_label: Optional[str]
```

Update `api/main.py` to query and return `claude_label`:

```python
query = """
    SELECT id, title, x, y, z, cluster_id, cluster_label, claude_label, ...
    FROM papers
    WHERE x IS NOT NULL AND y IS NOT NULL
"""
```

### Frontend (Visualization)

Update `frontend/src/types/index.ts`:

```typescript
export interface PaperSummary {
  // ... existing fields ...
  claude_label: string | null;
}
```

Modify visualization components to display `claude_label` instead of `cluster_label`:

```typescript
const displayLabel = paper.claude_label || paper.cluster_label || `Cluster ${paper.cluster_id}`;
```

## Current Labels (100 Clusters)

The current set of 100 Claude-curated labels can be found in `tooling/update_claude_labels.sql`.

Key improvements over automated labels:

- **Cluster 0**: "Geology & Paleoclimatology" (was: "Evidence, Quantitative, Geology")
- **Cluster 17**: "Cancer Biology & microRNA" (was: "Cancer, Mir, Cell")
- **Cluster 31**: "Quantum Physics & Spin Systems" (was: "Quantum, Spin, States")
- **Cluster 63**: "Computational Chemistry & Quantum Calculations" (was: "Mol, Kcal Mol, Kcal")
- **Cluster 97**: "COVID-19 Infection & Clinical Management" (was: "Infection, Covid, Clinical")

## Re-running the Process

When cluster assignments change (e.g., after re-running clustering with different parameters):

1. Sample papers from each cluster
2. Analyze content to understand themes
3. Draft new descriptive labels
4. Update `tooling/update_claude_labels.sql` with new labels
5. Execute the SQL script to update the database
6. Verify changes and test in the visualization

## Tips for Label Quality

- **Be specific**: "Antimicrobial Resistance & Microbiology" > "Clinical Microbiology"
- **Use domain terminology**: "Phylogenetics" > "Tree Analysis"
- **Combine concepts**: "Materials Engineering & Structural Stress"
- **Avoid redundancy**: Not "Molecular Biology & Molecular Genetics" but "Molecular Biology & Genetics"
- **Check for clarity**: Labels should be understandable to researchers outside the specific field
